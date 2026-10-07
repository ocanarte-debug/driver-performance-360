/**
 * Driver Performance 360 — api.js
 * Data provider abstraction: wraps mock data and live Geotab API.
 * Toggles between modes via DP360.Storage preferences (useMockData).
 * Namespace: DP360.API
 * Version: 1.0.0
 */

(function (DP360) {
  'use strict';

  // ─── Mode Detection ───────────────────────────────────────────────────────

  function isMockMode() {
    if (DP360.Storage) {
      const prefs = DP360.Storage.getPreferences();
      return prefs.useMockData !== false; // default true
    }
    return true;
  }

  // ─── Context (injected by MyGeotab or null in mock) ───────────────────────

  let _api   = null; // MyGeotab api object
  let _state = null; // MyGeotab state object

  function setContext(api, state) {
    _api   = api;
    _state = state;
  }

  // ─── Core: fetch exception events for date range ──────────────────────────

  /**
   * Get all exception events within date range.
   * Returns array of {ruleId, ruleName, vehicleId, driverName, driverId,
   *                   duration, distanceKm, timestamp}
   */
  async function getExceptionEvents(dateFrom, dateTo) {
    if (isMockMode()) return _mockExceptionEvents(dateFrom, dateTo);

    if (!_api) throw new Error('DP360: No Geotab API context');

    const results = await _callGeotab('Get', {
      typeName: 'ExceptionEvent',
      search: {
        fromDate: dateFrom.toISOString(),
        toDate:   dateTo.toISOString(),
        ruleSearch: { isSystem: false }
      }
    });

    return (results || []).map(ev => ({
      ruleId:      ev.rule ? ev.rule.id : null,
      ruleName:    ev.rule ? ev.rule.name : '',
      vehicleId:   ev.device ? ev.device.id : null,
      driverName:  ev.driver ? (ev.driver.name || '') : '',
      driverId:    ev.driver ? ev.driver.id : null,
      duration:    ev.duration || 0,       // seconds
      distanceKm:  (ev.distance || 0) / 1000,
      timestamp:   ev.activeFrom
    }));
  }

  // ─── Core: fetch trip summary per driver ──────────────────────────────────

  /**
   * Get trip summaries for all drivers in date range.
   * Returns array of {driverId, vehicleId, distanceKm, drivingSeconds,
   *                   idleSeconds, engineOnSeconds}
   */
  async function getTripSummaries(dateFrom, dateTo) {
    if (isMockMode()) return _mockTripSummaries(dateFrom, dateTo);
    if (!_api) throw new Error('DP360: No Geotab API context');

    // Use Geotab's StatusData / LogRecord approach for distance+idle
    // We query DeviceStatusInfo for a snapshot and Trip entity for history.
    const trips = await _callGeotab('Get', {
      typeName: 'Trip',
      search: {
        fromDate: dateFrom.toISOString(),
        toDate:   dateTo.toISOString()
      }
    });

    // Aggregate per driver+vehicle
    const agg = {};
    (trips || []).forEach(t => {
      const dId = t.driver ? t.driver.id : 'unknown';
      const vId = t.device ? t.device.id : 'unknown';
      const key = `${dId}::${vId}`;
      if (!agg[key]) {
        agg[key] = {
          driverId: dId,
          driverName: t.driver ? (t.driver.name || '') : '',
          vehicleId: vId,
          distanceKm: 0,
          drivingSeconds: 0,
          idleSeconds: 0,
          engineOnSeconds: 0
        };
      }
      agg[key].distanceKm     += (t.distance || 0) / 1000;
      agg[key].drivingSeconds += t.drivingDuration  || 0;
      agg[key].idleSeconds    += t.idlingDuration   || 0;
      agg[key].engineOnSeconds+= t.engineOnDuration || 0;
    });

    return Object.values(agg);
  }

  // ─── Core: fetch drivers and vehicles ─────────────────────────────────────

  async function getDrivers() {
    if (isMockMode()) return DP360.MockData.getDrivers();
    if (!_api) throw new Error('DP360: No Geotab API context');

    const users = await _callGeotab('Get', {
      typeName: 'Driver',
      search: { isDriver: true, isActive: true }
    });

    return (users || []).map(u => ({
      id:       u.id,
      name:     u.name || (u.firstName + ' ' + u.lastName).trim(),
      licenseId: u.licenseNumber || '',
      groups:   (u.groups || []).map(g => g.id)
    }));
  }

  async function getVehicles() {
    if (isMockMode()) return DP360.MockData.getVehicles();
    if (!_api) throw new Error('DP360: No Geotab API context');

    const devices = await _callGeotab('Get', {
      typeName: 'Device',
      search: { fromDate: 'MinDate', toDate: 'MaxDate', isActive: true }
    });

    return (devices || []).map(d => ({
      id:          d.id,
      name:        d.name || '',
      vehicleType: _inferVehicleType(d),
      fuelType:    _inferFuelType(d),
      groups:      (d.groups || []).map(g => g.id)
    }));
  }

  // ─── Core: fetch exception rules ──────────────────────────────────────────

  async function getExceptionRules() {
    if (isMockMode()) return DP360.MockData.getExceptionRules();
    if (!_api) throw new Error('DP360: No Geotab API context');

    const rules = await _callGeotab('Get', {
      typeName: 'Rule',
      search: { isSystem: false }
    });

    return (rules || []).map(r => ({
      id:   r.id,
      name: r.name || '',
      comment: r.comment || ''
    }));
  }

  // ─── Core: fetch fuel data ────────────────────────────────────────────────

  async function getFuelData(vehicleIds, dateFrom, dateTo, vehicleMap) {
    if (isMockMode()) {
      const provider = new DP360.FuelProvider.MockFuelProvider(vehicleMap || {});
      return await provider.getData(vehicleIds, dateFrom, dateTo);
    }

    const provider = new DP360.FuelProvider.GeotabFuelProvider(_api);
    return await provider.getData(vehicleIds, dateFrom, dateTo);
  }

  // ─── High-level: build complete driver metrics for evaluation ─────────────

  /**
   * Main data load pipeline.
   * Returns array of driver metric objects ready for DP360.ScoreEngine.evaluateAll()
   */
  async function loadDriverMetrics(dateFrom, dateTo) {
    // 1. Load reference data
    const [drivers, vehicles, rules, tripSummaries, events] = await Promise.all([
      getDrivers(),
      getVehicles(),
      getExceptionRules(),
      getTripSummaries(dateFrom, dateTo),
      getExceptionEvents(dateFrom, dateTo)
    ]);

    // 2. Build lookup maps
    const vehicleMap = {};
    vehicles.forEach(v => { vehicleMap[v.id] = v; });

    const driverMap = {};
    drivers.forEach(d => { driverMap[d.id] = d; });

    // 3. Get active rule mapping
    const ruleMapping = DP360.Storage ? DP360.Storage.getRuleMapping() : {};

    // 4. Aggregate exception events per driver+vehicle+category
    const exceptionAgg = {};
    events.forEach(ev => {
      if (!ev.driverId || !ev.vehicleId) return;
      const key = `${ev.driverId}::${ev.vehicleId}`;
      if (!exceptionAgg[key]) {
        exceptionAgg[key] = {
          driverId: ev.driverId,
          vehicleId: ev.vehicleId,
          speeding: 0,
          harshBraking: 0,
          harshAcceleration: 0,
          harshCornering: 0,
          other: 0
        };
      }
      const vehicle = vehicleMap[ev.vehicleId];
      const vehicleType = vehicle ? vehicle.vehicleType : 'default';
      // Resolve category via rule mapping (vehicleType → default)
      const category = _resolveCategory(ev.ruleId, vehicleType, ruleMapping);
      if (category && exceptionAgg[key][category] !== undefined) {
        exceptionAgg[key][category]++;
      } else {
        exceptionAgg[key].other++;
      }
    });

    // 5. Aggregate trip data per driver+vehicle
    const tripAgg = {};
    tripSummaries.forEach(t => {
      const key = `${t.driverId}::${t.vehicleId}`;
      tripAgg[key] = t;
    });

    // 6. Get fuel data
    const vehicleIds = Object.keys(vehicleMap);
    const fuelDataList = await getFuelData(vehicleIds, dateFrom, dateTo, vehicleMap);
    const fuelMap = {};
    fuelDataList.forEach(f => { fuelMap[f.vehicleId] = f; });

    // 7. Build combined driver metric objects
    const combinedKeys = new Set([
      ...Object.keys(exceptionAgg),
      ...Object.keys(tripAgg)
    ]);

    const metrics = [];
    combinedKeys.forEach(key => {
      const [driverId, vehicleId] = key.split('::');
      const trip    = tripAgg[key]      || {};
      const exc     = exceptionAgg[key] || {};
      const vehicle = vehicleMap[vehicleId] || {};
      const driver  = driverMap[driverId]   || {};
      const fuel    = fuelMap[vehicleId]    || {};

      const distanceKm = trip.distanceKm || 0;
      if (distanceKm === 0) return; // skip zero-distance entries

      metrics.push({
        driverId:         driverId,
        driverName:       driver.name || trip.driverName || 'Desconocido',
        vehicleId:        vehicleId,
        vehicleType:      vehicle.vehicleType || 'Vehículo Liviano',
        fuelType:         vehicle.fuelType    || 'Gasolina',
        group:            _resolveGroup(vehicle, driver),

        // Distance & time
        distanceKm:       distanceKm,
        drivingSeconds:   trip.drivingSeconds  || 0,
        idleSeconds:      trip.idleSeconds     || 0,
        engineOnSeconds:  trip.engineOnSeconds || 0,

        // Safety events (raw counts)
        speeding:         exc.speeding          || 0,
        harshBraking:     exc.harshBraking      || 0,
        harshAcceleration:exc.harshAcceleration || 0,
        harshCornering:   exc.harshCornering    || 0,
        other:            exc.other             || 0,

        // Fuel
        fuelData: {
          vehicleId:  vehicleId,
          fuelType:   vehicle.fuelType || 'Gasolina',
          totalUsed:  fuel.totalUsed  || 0,   // L or m³
          distanceKm: distanceKm
        }
      });
    });

    return metrics;
  }

  // ─── Weekly trend data ────────────────────────────────────────────────────

  async function getWeeklyTrend(driverId) {
    if (isMockMode()) return DP360.MockData.getDriverWeeklyTrend(driverId);
    // Live: would require fetching per-week evaluations — expensive
    // Return empty array; calling code should handle gracefully
    return [];
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function _resolveCategory(ruleId, vehicleType, mapping) {
    if (!ruleId || !mapping) return null;
    const byType = mapping[vehicleType] || {};
    if (byType[ruleId]) return byType[ruleId];
    const byDefault = mapping['default'] || {};
    return byDefault[ruleId] || null;
  }

  function _resolveGroup(vehicle, driver) {
    // Try vehicle groups first, then driver groups
    const grp = (vehicle.groups || [])[0] || (driver.groups || [])[0] || '';
    return grp;
  }

  function _inferVehicleType(device) {
    const name = (device.name || '').toLowerCase();
    if (name.includes('camion') || name.includes('camión') || name.includes('truck')) return 'Camión';
    if (name.includes('camioneta') || name.includes('pickup')) return 'Camioneta';
    if (name.includes('gnv') || name.includes('gas')) return 'Camión GNV';
    return 'Vehículo Liviano';
  }

  function _inferFuelType(device) {
    const name = (device.name || '').toLowerCase();
    if (name.includes('gnv') || name.includes('gas natural')) return 'GNV';
    if (name.includes('diesel') || name.includes('diésel')) return 'Diésel';
    return 'Gasolina';
  }

  // ─── Geotab API call wrapper ──────────────────────────────────────────────

  async function _callGeotab(method, params) {
    return new Promise((resolve, reject) => {
      if (!_api || typeof _api.call !== 'function') {
        reject(new Error('DP360: Geotab API not initialized'));
        return;
      }
      _api.call(method, params,
        function (result) { resolve(result); },
        function (err)    { reject(new Error(err)); }
      );
    });
  }

  // ─── Mock helpers ─────────────────────────────────────────────────────────

  function _mockExceptionEvents(dateFrom, dateTo) {
    // MockData.getMetrics already aggregates events — we return empty here
    // because loadDriverMetrics uses getMetrics directly in mock mode.
    return [];
  }

  function _mockTripSummaries(dateFrom, dateTo) {
    return [];
  }

  /**
   * Full mock pipeline — bypasses the live aggregation.
   * Called by loadDriverMetrics when in mock mode.
   */
  async function loadMockMetrics(dateFrom, dateTo) {
    // MockData.getMetrics() already returns { driver, vehicle, metrics, fuelData }
    // with driver.group set from DRIVERS catalog — no extra processing needed.
    return DP360.MockData.getMetrics(dateFrom, dateTo);
  }

  // ─── Public loadDriverMetrics override for mock mode ─────────────────────

  async function loadAllMetrics(dateFrom, dateTo) {
    if (isMockMode()) return loadMockMetrics(dateFrom, dateTo);
    return loadDriverMetrics(dateFrom, dateTo);
  }

  // ─── Metadata helpers ─────────────────────────────────────────────────────

  async function getAvailableGroups() {
    const vehicles = await getVehicles();
    const groups = [...new Set(vehicles.map(v => v.group || 'Sin zona').filter(Boolean))];
    return groups.sort();
  }

  async function getAvailableVehicleTypes() {
    const vehicles = await getVehicles();
    const types = [...new Set(vehicles.map(v => v.vehicleType).filter(Boolean))];
    return types.sort();
  }

  async function getAvailableFuelTypes() {
    const vehicles = await getVehicles();
    const fuels = [...new Set(vehicles.map(v => v.fuelType).filter(Boolean))];
    return fuels.sort();
  }

  // ─── Export ───────────────────────────────────────────────────────────────

  DP360.API = {
    // Context
    setContext,
    isMockMode,

    // Core loaders
    getDrivers,
    getVehicles,
    getExceptionRules,
    getExceptionEvents,
    getTripSummaries,
    getFuelData,

    // High-level
    loadAllMetrics,
    getWeeklyTrend,

    // Metadata
    getAvailableGroups,
    getAvailableVehicleTypes,
    getAvailableFuelTypes
  };

})(window.DP360 = window.DP360 || {});

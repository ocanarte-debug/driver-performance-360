
/* DP360.FuelProvider — Adaptador de datos de combustible
 * Interfaz unificada para Diésel/Gasolina/GNV.
 * IMPORTANTE: La fuente de GNV puede ser externa a Geotab.
 *
 * Para conectar una fuente externa de GNV, implementa FuelDataProvider
 * e inyéctala con DP360.FuelProvider.setGNVProvider(myProvider).
 *
 * Depende de: storage.js
 */
'use strict';
window.DP360 = window.DP360 || {};

DP360.FuelProvider = (function () {

  /* ── Interfaz FuelDataProvider ───────────────────────────────────── */
  // Cualquier provider debe implementar:
  //   async getData(vehicleIds, dateFrom, dateTo): Promise<FuelRecord[]>
  //
  // FuelRecord = {
  //   vehicleId, driverId, dateFrom, dateTo,
  //   fuelType,            // 'Diesel' | 'Gasoline' | 'GNV'
  //   fuelUsed,            // litros (diesel/gasolina) o null
  //   m3Used,              // m³ (GNV) o null
  //   fuelCostUSD,         // costo estimado USD o null
  //   fuelPricePerUnit,    // precio por L o m³
  //   source               // 'geotab' | 'external_csv' | 'mock'
  // }

  let _gnvProvider = null;

  /** Inyecta un provider externo de GNV. */
  function setGNVProvider(provider) {
    if (typeof provider.getData !== 'function') {
      throw new Error('FuelDataProvider debe implementar getData()');
    }
    _gnvProvider = provider;
  }

  /* ── Provider Mock ───────────────────────────────────────────────── */
  const MockFuelProvider = {
    async getData(vehicleIds, dateFrom, dateTo, vehicleMap) {
      return vehicleIds.map(vid => {
        const v = vehicleMap?.[vid] || {};
        const ft = v.fuelType || 'Diésel';
        const dist = v._mockDistance || 800;
        let fuelUsed = null, m3Used = null;

        if (ft === 'GNV') {
          m3Used = C.round(dist / (1.6 + Math.random() * 0.4), 0);
        } else if (ft === 'Diésel') {
          const rate = ft === 'Camión' ? 0.35 : 0.18;
          fuelUsed = C.round(dist * (rate + (Math.random() - 0.5) * 0.04), 0);
        } else {
          fuelUsed = C.round(dist * (0.11 + (Math.random() - 0.5) * 0.02), 0);
        }

        return {
          vehicleId: vid,
          driverId: v._mockDriverId || null,
          fuelType: ft,
          fuelUsed, m3Used,
          fuelCostUSD: fuelUsed ? C.round(fuelUsed * 0.98, 2) : null,
          fuelPricePerUnit: ft === 'GNV' ? 0.42 : 0.98,
          source: 'mock'
        };
      });
    }
  };

  /* ── Provider Geotab ─────────────────────────────────────────────── */
  // REQUIRES VALIDATION: los campos exactos de StatusData para combustible
  // varían según el tipo de vehículo y configuración del dispositivo.
  // Ver API_MAPPING.md para detalles.
  const GeotabFuelProvider = {
    async getData(vehicleIds, dateFrom, dateTo, api) {
      // REQUIRES VALIDATION: confirmar diagnóstico ID para fuel level/usage
      // Típicamente se usan StatusData con diagnóstico 'FuelUsed' o similar
      console.warn('[DP360.FuelProvider] GeotabFuelProvider: REQUIRES VALIDATION - ver API_MAPPING.md');

      // Placeholder — retorna registros vacíos para que el sistema no falle
      return vehicleIds.map(vid => ({
        vehicleId: vid, fuelType: 'Diésel',
        fuelUsed: null, m3Used: null, source: 'geotab_pending'
      }));
    }
  };

  /* ── CSV Import para GNV ─────────────────────────────────────────── */
  /** Parsea un CSV con columnas: vehicleId, dateFrom, dateTo, m3Used, km */
  function parseGNVCsv(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    return lines.slice(1).map(line => {
      const vals = line.split(',');
      const record = {};
      headers.forEach((h, i) => { record[h] = vals[i]?.trim(); });
      return {
        vehicleId: record['vehicleid'] || record['vehicle_id'] || record['placa'],
        fuelType: 'GNV',
        m3Used: parseFloat(record['m3used'] || record['m3'] || 0) || null,
        fuelUsed: null,
        source: 'external_csv'
      };
    }).filter(r => r.vehicleId);
  }

  const C = DP360.Calc || { round: (v, d) => parseFloat(v.toFixed(d)) };

  return {
    MockFuelProvider,
    GeotabFuelProvider,
    setGNVProvider,
    parseGNVCsv,
    get activeGNVProvider() { return _gnvProvider; }
  };
})();

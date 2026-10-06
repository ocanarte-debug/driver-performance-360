
/* DP360.MockData — Datos simulados realistas para modo demo
 * 40 conductores, 12 semanas, múltiples tipos vehículo/combustible.
 * USE_MOCK_DATA se controla desde DP360.Storage preferences.
 */
'use strict';
window.DP360 = window.DP360 || {};

DP360.MockData = (function () {

  /* ── Seed RNG reproducible ──────────────────────────────────────── */
  function seededRng(seed) {
    let s = seed;
    return function() {
      s = (s * 16807 + 0) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  const rng = seededRng(42);
  function rand(min, max) { return min + rng() * (max - min); }
  function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
  function pick(arr) { return arr[randInt(0, arr.length - 1)]; }
  function round(v, d) { return parseFloat(v.toFixed(d)); }

  /* ── Catálogos base ─────────────────────────────────────────────── */
  const NAMES = [
    'Carlos Rodríguez','María García','José Martínez','Ana López','Luis González',
    'Carmen Pérez','Manuel Sánchez','Patricia Jiménez','Roberto Díaz','Elena Moreno',
    'Francisco Torres','Isabel Ramírez','Antonio Flores','Laura Herrera','Miguel Castro',
    'Sofía Ruiz','Jorge Vargas','Verónica Mendoza','Ricardo Ortiz','Claudia Silva',
    'Eduardo Rojas','Adriana Reyes','Sergio Medina','Paola Suárez','Andrés Mora',
    'Natalia Guerrero','Pablo Navarro','Gabriela Ríos','Fernando León','Ximena Aguilar',
    'Héctor Vega','Diana Castillo','Alberto Romero','Valeria Paredes','Rodrigo Acosta',
    'Camila Ibáñez','Gustavo Peña','Mónica Fuentes','Raúl Contreras','Daniela Ramos'
  ];

  const GROUPS = ['Quito', 'Guayaquil', 'Cuenca', 'Ambato'];
  const OPERATIONS = ['Distribución', 'Transporte', 'Logística', 'Operaciones'];

  const VEHICLE_CONFIGS = [
    // 15 Camiones Diésel
    ...Array.from({length: 15}, (_, i) => ({
      type: 'Camión', fuel: 'Diésel',
      plate: `GBA-${String(1000 + i).padStart(4, '0')}`,
      baseKmPerL: 2.8, baseIdleRate: 10,
      speedFactor: 0.8, brakeBase: 0.7, accelBase: 0.9
    })),
    // 15 Camionetas Gasolina
    ...Array.from({length: 15}, (_, i) => ({
      type: 'Camioneta', fuel: 'Gasolina',
      plate: `PBC-${String(2000 + i).padStart(4, '0')}`,
      baseKmPerL: 5.2, baseIdleRate: 7,
      speedFactor: 1.2, brakeBase: 1.1, accelBase: 1.4
    })),
    // 7 Vehículos Livianos Gasolina
    ...Array.from({length: 7}, (_, i) => ({
      type: 'Vehículo Liviano', fuel: 'Gasolina',
      plate: `MEC-${String(3000 + i).padStart(4, '0')}`,
      baseKmPerL: 9.0, baseIdleRate: 5,
      speedFactor: 1.6, brakeBase: 1.3, accelBase: 1.7
    })),
    // 3 Camiones GNV
    ...Array.from({length: 3}, (_, i) => ({
      type: 'Camión', fuel: 'GNV',
      plate: `GNV-${String(4000 + i).padStart(4, '0')}`,
      baseKmM3: 1.75, baseIdleRate: 9,
      speedFactor: 0.85, brakeBase: 0.75, accelBase: 0.95
    }))
  ];

  /* ── Generación de drivers y vehículos ──────────────────────────── */
  const DRIVERS = NAMES.map((name, i) => ({
    id: `DRV-${String(i + 1).padStart(3, '0')}`,
    name,
    employeeId: `E${String(1001 + i)}`,
    licenseNumber: `LIC-${String(10000 + i)}`,
    group: GROUPS[i % GROUPS.length],
    operation: OPERATIONS[i % OPERATIONS.length]
  }));

  const VEHICLES = VEHICLE_CONFIGS.map((vc, i) => ({
    id: `VEH-${String(i + 1).padStart(3, '0')}`,
    plate: vc.plate,
    vehicleType: vc.type,
    fuelType: vc.fuel,
    ...vc
  }));

  /* ── Exception Rules Mock ───────────────────────────────────────── */
  const EXCEPTION_RULES = [
    { id: 'ER001', name: 'Exceso de Velocidad',            description: 'Velocidad sobre el límite de la vía' },
    { id: 'ER002', name: 'Frenada Brusca',                 description: 'Desaceleración mayor a umbral configurado' },
    { id: 'ER003', name: 'Aceleración Brusca',             description: 'Aceleración mayor a umbral configurado' },
    { id: 'ER004', name: 'Curva Agresiva',                 description: 'Fuerza lateral excesiva en curva' },
    { id: 'ER005', name: 'Ralentí Excesivo',               description: 'Motor encendido sin movimiento > 5 min' },
    { id: 'ER006', name: 'Speeding Alert',                 description: 'Alerta de velocidad (inglés)' },
    { id: 'ER007', name: 'Hard Braking',                   description: 'Frenada brusca (inglés)' },
    { id: 'ER008', name: 'Hard Acceleration',              description: 'Aceleración brusca (inglés)' },
    { id: 'ER009', name: 'Harsh Cornering',                description: 'Curva agresiva (inglés)' },
    { id: 'ER010', name: 'Exceso Vel. Camión > 90 km/h',  description: 'Camión sobre 90 km/h' },
    { id: 'ER011', name: 'Exceso Vel. Camioneta > 110',   description: 'Camioneta sobre 110 km/h' },
    { id: 'ER012', name: 'Frenada Brusca - Camión',       description: 'Umbral específico para camiones' },
    { id: 'ER013', name: 'Aceleración - Camión',          description: 'Umbral aceleración camiones' },
    { id: 'ER014', name: 'Conducción Agresiva',            description: 'Combinación de eventos' },
    { id: 'ER015', name: 'Zona Escolar',                   description: 'Eventos en zona escolar' }
  ];

  /* Mapeo default de reglas (simula configuración guardada) */
  const DEFAULT_RULE_MAPPING = {
    default: {
      'ER001': 'speeding', 'ER002': 'harshBraking', 'ER003': 'harshAcceleration',
      'ER004': 'harshCornering', 'ER005': 'other', 'ER006': 'speeding',
      'ER007': 'harshBraking', 'ER008': 'harshAcceleration', 'ER009': 'harshCornering',
      'ER010': 'speeding', 'ER011': 'speeding', 'ER012': 'harshBraking',
      'ER013': 'harshAcceleration', 'ER014': 'other', 'ER015': 'other'
    },
    'Camión': {
      'ER010': 'speeding', 'ER012': 'harshBraking', 'ER013': 'harshAcceleration'
    },
    'Camioneta': {
      'ER011': 'speeding'
    }
  };

  /* ── Generación de métricas semanales ───────────────────────────── */
  function generateWeeklyMetrics(driverIdx, vehicleIdx, weekOffset) {
    const vc = VEHICLES[vehicleIdx];
    // Perfil base del conductor (índice determina tendencia de comportamiento)
    const profile = driverIdx / NAMES.length; // 0=excelente, 1=pésimo
    const trend = Math.sin(weekOffset * 0.3) * 0.1; // tendencia temporal
    const noise = (rng() - 0.5) * 0.15;
    const effectiveProfile = Math.max(0, Math.min(1, profile + trend + noise));

    // Distancia semanal (km)
    const distanceKm = round(rand(600, 2200), 0);
    const drivingHours = round(distanceKm / rand(50, 75), 1);
    const engineHours = round(drivingHours * rand(1.05, 1.25), 1);
    const idleMinutes = round(engineHours * rand(0.03, 0.22) * 60, 0);

    // Eventos de seguridad — normalizados por 100km, escalados por perfil
    function events(base, profileScale) {
      const per100km = base * (0.3 + effectiveProfile * profileScale);
      return Math.max(0, Math.round((per100km * distanceKm / 100) + (rng() - 0.5) * 2));
    }

    const speedingEvents         = events(vc.speedFactor * 1.0, 2.5);
    const harshBrakingEvents     = events(vc.brakeBase * 0.9, 2.2);
    const harshAccelerationEvents = events(vc.accelBase * 1.0, 2.3);
    const harshCorneringEvents   = events(vc.brakeBase * 0.7, 1.8);
    const otherSafetyEvents      = events(0.3, 1.5);

    // Combustible
    let fuelUsed = null, m3Used = null;
    if (vc.fuel === 'GNV') {
      const effBase = vc.baseKmM3 || 1.75;
      const eff = effBase * (1 - effectiveProfile * 0.25 + (rng() - 0.5) * 0.1);
      m3Used = round(distanceKm / Math.max(eff, 0.5), 0);
    } else {
      const effBase = vc.baseKmPerL || 4.0;
      const eff = effBase * (1 - effectiveProfile * 0.2 + (rng() - 0.5) * 0.08);
      fuelUsed = round(distanceKm / Math.max(eff, 0.5), 0);
    }

    return {
      distanceKm, drivingHours, engineHours, idleMinutes,
      availableHours: 56, // 8h/día x 7 días
      speedingEvents, harshBrakingEvents, harshAccelerationEvents,
      harshCorneringEvents, otherSafetyEvents,
      fuelUsed, m3Used,
      fuelType: vc.fuel
    };
  }

  /* ── Datos agregados por período ───────────────────────────────────── */
  function aggregateMetrics(weeklyList) {
    const agg = {
      distanceKm: 0, drivingHours: 0, engineHours: 0, idleMinutes: 0,
      availableHours: 0,
      speedingEvents: 0, harshBrakingEvents: 0, harshAccelerationEvents: 0,
      harshCorneringEvents: 0, otherSafetyEvents: 0,
      fuelUsed: 0, m3Used: 0
    };
    for (const w of weeklyList) {
      for (const k of Object.keys(agg)) {
        agg[k] += (w[k] || 0);
      }
    }
    agg.fuelType = weeklyList[0]?.fuelType || 'Diésel';
    return agg;
  }

  /* ── Dataset completo ────────────────────────────────────────────── */
  // 12 semanas: W29 a W40 de 2026
  const WEEKS = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(2026, 6, 14 + i * 7); // 14-Jul-2026
    const y = d.getFullYear();
    const start = new Date(d);
    const end = new Date(d); end.setDate(end.getDate() + 6);
    const wn = Math.ceil(((d - new Date(y, 0, 1)) / 86400000 + 1) / 7);
    WEEKS.push({
      label: `W${String(wn).padStart(2,'0')}-${y}`,
      dateFrom: start.toISOString().slice(0, 10),
      dateTo: end.toISOString().slice(0, 10),
      offset: i
    });
  }

  // Asignación conductor→vehículo (estable durante el período)
  const ASSIGNMENTS = DRIVERS.map((d, i) => ({
    driverId: d.id,
    vehicleId: VEHICLES[i % VEHICLES.length].id,
    vehicleIdx: i % VEHICLES.length
  }));

  // Métricas semanales por conductor
  const WEEKLY_METRICS = {};
  DRIVERS.forEach((driver, di) => {
    WEEKLY_METRICS[driver.id] = {};
    const { vehicleIdx } = ASSIGNMENTS[di];
    WEEKS.forEach((week, wi) => {
      WEEKLY_METRICS[driver.id][week.label] = {
        ...generateWeeklyMetrics(di, vehicleIdx, wi),
        period: week.label,
        dateFrom: week.dateFrom,
        dateTo: week.dateTo
      };
    });
  });

  /* ── API pública ─────────────────────────────────────────────────── */

  function getDrivers() { return DRIVERS; }
  function getVehicles() { return VEHICLES; }
  function getExceptionRules() { return EXCEPTION_RULES; }
  function getDefaultRuleMapping() { return DEFAULT_RULE_MAPPING; }

  function getVehicleById(id) { return VEHICLES.find(v => v.id === id); }
  function getDriverById(id) { return DRIVERS.find(d => d.id === id); }

  function getAssignment(driverId) {
    const a = ASSIGNMENTS.find(a => a.driverId === driverId);
    return a ? getVehicleById(a.vehicleId) : null;
  }

  /** Retorna métricas agregadas para todos los conductores en el rango de semanas. */
  function getMetrics(dateFrom, dateTo) {
    const fromDate = new Date(dateFrom);
    const toDate   = new Date(dateTo);

    return DRIVERS.map(driver => {
      const weeksInRange = WEEKS.filter(w => {
        const wStart = new Date(w.dateFrom);
        const wEnd   = new Date(w.dateTo);
        return wEnd >= fromDate && wStart <= toDate;
      });

      const weeklyList = weeksInRange.map(w => WEEKLY_METRICS[driver.id][w.label]).filter(Boolean);
      if (weeklyList.length === 0) return null;

      const agg = aggregateMetrics(weeklyList);
      const vehicle = getAssignment(driver.id);

      return {
        driver,
        vehicle,
        metrics: { ...agg, period: `${dateFrom} → ${dateTo}` },
        fuelData: {
          fuelUsed: agg.fuelUsed,
          m3Used: agg.m3Used,
          fuelType: agg.fuelType,
          fuelPerIdleHour: agg.fuelType === 'GNV' ? null : (agg.fuelUsed / agg.engineHours) * 0.65
        }
      };
    }).filter(Boolean);
  }

  /** Retorna métricas semanales de un conductor (para gráficos de tendencia). */
  function getDriverWeeklyTrend(driverId) {
    const weeks = WEEKLY_METRICS[driverId];
    if (!weeks) return [];
    return WEEKS.map(w => ({
      week: w.label, dateFrom: w.dateFrom, dateTo: w.dateTo,
      ...weeks[w.label]
    }));
  }

  /** Retorna el listado de semanas disponibles. */
  function getAvailableWeeks() { return WEEKS; }

  return {
    getDrivers, getVehicles, getExceptionRules, getDefaultRuleMapping,
    getVehicleById, getDriverById, getAssignment,
    getMetrics, getDriverWeeklyTrend, getAvailableWeeks
  };
})();

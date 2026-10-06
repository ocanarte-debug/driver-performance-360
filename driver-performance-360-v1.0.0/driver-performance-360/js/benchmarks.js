
/* DP360.Benchmarks — Cálculo dinámico de benchmarks desde datos reales
 * Depende de: calculations.js
 */
'use strict';
window.DP360 = window.DP360 || {};

DP360.Benchmarks = (function () {
  const C = DP360.Calc;

  /** Calcula benchmarks de flota desde array de evaluaciones.
   *  Retorna percentiles P25/P50/P75 por métrica.
   */
  function calcFleetBenchmarks(evaluatedDrivers, config) {
    const valid = evaluatedDrivers.filter(d => d.evaluationStatus !== 'insufficient' && d.score !== null);
    if (valid.length < 5) return null; // insuficiente para percentiles confiables

    const fields = [
      'score', 'safetyScore', 'efficiencyScore',
      'safety.components.speeding.per100km',
      'safety.components.harshBraking.per100km',
      'safety.components.harshAcceleration.per100km',
      'safety.components.harshCornering.per100km',
      'safety.components.other.per100km',
      'efficiency.components.idling.idleRatePct',
      'efficiency.components.fuel.consumption',
      'efficiency.components.utilization.utilizationPct'
    ];

    const result = {};
    for (const field of fields) {
      const values = valid.map(d => getNestedValue(d, field)).filter(v => v !== null && !isNaN(v));
      if (values.length >= 3) {
        const key = field.replace(/\./g, '_');
        result[key] = {
          p25: C.round(C.percentile(values, 25), 2),
          p50: C.round(C.percentile(values, 50), 2),
          p75: C.round(C.percentile(values, 75), 2),
          avg: C.round(C.average(values), 2),
          min: C.round(Math.min(...values), 2),
          max: C.round(Math.max(...values), 2),
          n: values.length
        };
      }
    }
    return result;
  }

  /** Benchmarks por grupo de vehículos. */
  function calcGroupBenchmarks(evaluatedDrivers, groupField) {
    const groups = {};
    for (const d of evaluatedDrivers) {
      const key = d[groupField] || 'Sin grupo';
      if (!groups[key]) groups[key] = [];
      groups[key].push(d);
    }
    const result = {};
    for (const [key, drivers] of Object.entries(groups)) {
      result[key] = calcFleetBenchmarks(drivers, null);
    }
    return result;
  }

  /** Obtiene benchmark apropiado para un conductor.
   *  Prioridad: tipo vehículo > global > null
   */
  function getBenchmarkForDriver(driver, staticBenchmarks) {
    const vt = driver.vehicleType || driver.vehicle?.vehicleType;
    return staticBenchmarks?.[vt] || staticBenchmarks?.global || null;
  }

  /** Compara un valor contra su benchmark.
   *  @returns {Object} {value, benchmark, deviation, direction}
   *  direction: 'better'|'worse'|'equal'|null
   */
  function compareValue(value, benchmark, lowerIsBetter = false) {
    if (value === null || benchmark === null) return { value, benchmark, deviation: null, direction: null };
    const deviation = C.round(((value / benchmark) - 1) * 100, 1);
    let direction;
    if (Math.abs(deviation) < 1) direction = 'equal';
    else if (lowerIsBetter) direction = deviation < 0 ? 'better' : 'worse';
    else direction = deviation > 0 ? 'better' : 'worse';
    return { value, benchmark, deviation, direction };
  }

  /** Helper para acceder a propiedades anidadas con puntos. */
  function getNestedValue(obj, path) {
    return path.split('.').reduce((acc, key) => acc?.[key] ?? null, obj);
  }

  /** Combina benchmarks estáticos con dinámicos para usarlos en el motor. */
  function resolveBenchmark(vehicleType, staticBenchmarks, dynamicBenchmarks) {
    // Dinámico por tipo de vehículo tiene prioridad
    if (dynamicBenchmarks?.[`vehicleType_${vehicleType}`]) {
      return dynamicBenchmarks[`vehicleType_${vehicleType}`];
    }
    return staticBenchmarks?.[vehicleType] || staticBenchmarks?.global || {};
  }

  return {
    calcFleetBenchmarks,
    calcGroupBenchmarks,
    getBenchmarkForDriver,
    compareValue,
    resolveBenchmark,
    getNestedValue
  };
})();

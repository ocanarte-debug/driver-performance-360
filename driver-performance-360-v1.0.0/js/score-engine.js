
/* DP360.ScoreEngine — Motor de puntuación Driver Performance 360
 * Depende de: calculations.js
 * Cada resultado incluye breakdowns completos para explicabilidad.
 */
'use strict';
window.DP360 = window.DP360 || {};

DP360.ScoreEngine = (function () {
  const C = DP360.Calc;

  /* ── Helpers ─────────────────────────────────────────────────────── */

  /** Evalúa un componente de seguridad basado en eventos/100km.
   *  @returns {Object} {metric, rawEvents, distanceKm, per100km, score, weight, weightedScore, threshold}
   */
  function evalSafetyComponent(metric, rawEvents, distanceKm, weight, thresholds) {
    const per100km = C.normalizePerKm(rawEvents, distanceKm);
    const score = C.scoreFromThresholds(per100km, thresholds);
    return {
      metric,
      rawEvents: rawEvents || 0,
      distanceKm: distanceKm || 0,
      per100km: C.round(per100km, 2),
      score: C.round(score, 1),
      weight,
      weightedScore: C.round(score * weight, 2)
    };
  }

  /** Evalúa ralentí.
   *  @returns {Object} breakdown de ralentí
   */
  function evalIdling(idleMinutes, engineHours, fuelPerIdleHour, weight, thresholds) {
    const idleRatePct = C.calcIdleRate(idleMinutes, engineHours);
    const score = C.scoreFromThresholds(idleRatePct, thresholds);
    const idleHours = (idleMinutes || 0) / 60;
    const idleFuelUsed = fuelPerIdleHour ? idleHours * fuelPerIdleHour : null;
    return {
      metric: 'idling',
      idleMinutes: idleMinutes || 0,
      idleHours: C.round(idleHours, 2),
      engineHours: engineHours || 0,
      idleRatePct: C.round(idleRatePct, 1),
      idleFuelUsed: idleFuelUsed !== null ? C.round(idleFuelUsed, 1) : null,
      score: C.round(score, 1),
      weight,
      weightedScore: C.round(score * weight, 2)
    };
  }

  /** Evalúa consumo de combustible.
   *  @returns {Object} breakdown de combustible
   */
  function evalFuel(fuelData, benchmark, weight, thresholds) {
    // fuelData: {fuelUsed, distanceKm, fuelType, m3Used}
    let actual = null, benchmarkVal = null, metric = 'kmL';
    if (fuelData.fuelType === 'GNV') {
      actual = C.calcKmPerM3(fuelData.m3Used, fuelData.distanceKm);
      benchmarkVal = benchmark?.fuelConsumption_kmM3 || null;
      metric = 'kmM3';
    } else {
      actual = C.calcKmPerLiter(fuelData.fuelUsed, fuelData.distanceKm);
      benchmarkVal = benchmark?.fuelConsumption_kmL || null;
    }

    // Para km/L o km/m³: mayor = mejor → lowerIsBetter=false para consumo
    // Pero comparamos: si actual < benchmark → conductor consume más → peor
    let deviationPct = null;
    let score = 50; // default si sin benchmark

    if (actual !== null && benchmarkVal !== null) {
      // desvío respecto al benchmark: actual/benchmark - 1
      // si actual < benchmark: negativo (peor)
      deviationPct = C.round(((actual / benchmarkVal) - 1) * 100, 1);
      // Para score: usamos |desvío negativo| — cuánto peor es
      const absNegDev = deviationPct < 0 ? Math.abs(deviationPct) : 0;
      score = C.scoreFromThresholds(absNegDev, thresholds);
    } else if (actual !== null) {
      score = 70; // sin benchmark, asumimos aceptable
    }

    return {
      metric: 'fuel',
      fuelType: fuelData.fuelType || 'Diésel',
      fuelUsed: fuelData.fuelType === 'GNV' ? fuelData.m3Used : fuelData.fuelUsed,
      fuelUnit: fuelData.fuelType === 'GNV' ? 'm³' : 'L',
      distanceKm: fuelData.distanceKm || 0,
      consumption: actual !== null ? C.round(actual, 2) : null,
      consumptionUnit: metric === 'kmM3' ? 'km/m³' : 'km/L',
      benchmarkConsumption: benchmarkVal ? C.round(benchmarkVal, 2) : null,
      deviationPct,
      score: C.round(score, 1),
      weight,
      weightedScore: C.round(score * weight, 2)
    };
  }

  /** Evalúa utilización.
   *  @returns {Object} breakdown de utilización
   */
  function evalUtilization(engineHours, availableHours, weight, thresholds) {
    if (!availableHours || availableHours <= 0) {
      return {
        metric: 'utilization', utilizationPct: null,
        score: 75, weight, weightedScore: C.round(75 * weight, 2),
        note: 'Sin horas disponibles configuradas'
      };
    }
    const utilizationPct = C.clamp((engineHours / availableHours) * 100, 0, 100);
    const score = C.scoreFromUtilThresholds(utilizationPct, thresholds);
    return {
      metric: 'utilization',
      engineHours: engineHours || 0,
      availableHours,
      utilizationPct: C.round(utilizationPct, 1),
      score: C.round(score, 1),
      weight,
      weightedScore: C.round(score * weight, 2)
    };
  }

  /* ── Safety Score ─────────────────────────────────────────────────── */

  function calcSafetyScore(metrics, config) {
    const w = config.safety;
    const t = config.thresholds;
    const dist = metrics.distanceKm || 0;

    const components = {
      speeding:          evalSafetyComponent('speeding',          metrics.speedingEvents        || 0, dist, w.speeding,         t.speeding),
      harshBraking:      evalSafetyComponent('harshBraking',      metrics.harshBrakingEvents    || 0, dist, w.harshBraking,     t.harshBraking),
      harshAcceleration: evalSafetyComponent('harshAcceleration', metrics.harshAccelerationEvents || 0, dist, w.harshAcceleration, t.harshAcceleration),
      harshCornering:    evalSafetyComponent('harshCornering',    metrics.harshCorneringEvents  || 0, dist, w.harshCornering,   t.harshCornering),
      other:             evalSafetyComponent('other',             metrics.otherSafetyEvents     || 0, dist, w.other,            t.other)
    };

    const safetyScore = C.clamp(
      components.speeding.weightedScore +
      components.harshBraking.weightedScore +
      components.harshAcceleration.weightedScore +
      components.harshCornering.weightedScore +
      components.other.weightedScore, 0, 100
    );

    const totalEvents = (metrics.speedingEvents || 0) +
      (metrics.harshBrakingEvents || 0) + (metrics.harshAccelerationEvents || 0) +
      (metrics.harshCorneringEvents || 0) + (metrics.otherSafetyEvents || 0);

    return {
      score: C.round(safetyScore, 1),
      weight: config.weights.safety,
      weightedScore: C.round(safetyScore * config.weights.safety, 2),
      totalEvents,
      eventsPerKm: C.round(C.normalizePerKm(totalEvents, dist), 2),
      components
    };
  }

  /* ── Efficiency Score ─────────────────────────────────────────────── */

  function calcEfficiencyScore(metrics, fuelData, benchmark, config) {
    const w = config.efficiency;
    const t = config.thresholds;
    const availHours = metrics.availableHours || null;

    const idlingResult = evalIdling(
      metrics.idleMinutes || 0,
      metrics.engineHours || 0,
      fuelData?.fuelPerIdleHour || null,
      w.idling, t.idling
    );

    const fuelResult = evalFuel(
      {
        fuelUsed: fuelData?.fuelUsed || 0,
        m3Used: fuelData?.m3Used || 0,
        distanceKm: metrics.distanceKm || 0,
        fuelType: fuelData?.fuelType || 'Diésel'
      },
      benchmark,
      w.fuel,
      t.fuelDeviation
    );

    const utilResult = config.utilizationEnabled
      ? evalUtilization(metrics.engineHours || 0, availHours, w.utilization, t.utilization)
      : { metric: 'utilization', score: 75, weight: w.utilization, weightedScore: C.round(75 * w.utilization, 2), note: 'Desactivado' };

    const effScore = C.clamp(
      idlingResult.weightedScore + fuelResult.weightedScore + utilResult.weightedScore,
      0, 100
    );

    return {
      score: C.round(effScore, 1),
      weight: config.weights.efficiency,
      weightedScore: C.round(effScore * config.weights.efficiency, 2),
      components: { idling: idlingResult, fuel: fuelResult, utilization: utilResult }
    };
  }

  /* ── Driver Score (principal) ─────────────────────────────────────── */

  /**
   * Evalúa un conductor completo.
   * @param {Object} driverData  - { driver, vehicle, metrics, fuelData, benchmark }
   * @param {Object} config      - scoring config (scoring.json parseado)
   * @returns {Object} resultado completo con breakdowns
   */
  function evaluateDriver(driverData, config) {
    const { driver, vehicle, metrics, fuelData, benchmark } = driverData;
    const dist = metrics?.distanceKm || 0;

    // Evaluar exposición
    let evaluationStatus = 'full';
    if (dist < (config.provisionalKm || 100)) evaluationStatus = 'insufficient';
    else if (dist < (config.minimumKm || 500))  evaluationStatus = 'provisional';

    if (evaluationStatus === 'insufficient') {
      return {
        driverId: driver.id, driverName: driver.name,
        vehicleId: vehicle?.id, vehiclePlate: vehicle?.plate,
        vehicleType: vehicle?.vehicleType || 'Desconocido',
        fuelType: fuelData?.fuelType || vehicle?.fuelType || 'Desconocido',
        period: metrics?.period,
        evaluationStatus: 'insufficient',
        distanceKm: dist,
        score: null, safetyScore: null, efficiencyScore: null,
        breakdown: null, statusLabel: null, statusColor: '#94a3b8'
      };
    }

    const safetyResult     = calcSafetyScore(metrics, config);
    const efficiencyResult = calcEfficiencyScore(metrics, fuelData, benchmark, config);

    const finalScore = C.clamp(
      safetyResult.weightedScore + efficiencyResult.weightedScore, 0, 100
    );

    const status = getStatus(finalScore, config);

    // Breakdown para explicabilidad
    const breakdown = buildBreakdown(finalScore, safetyResult, efficiencyResult);

    return {
      driverId: driver.id,
      driverName: driver.name,
      driverEmployeeId: driver.employeeId,
      vehicleId: vehicle?.id,
      vehiclePlate: vehicle?.plate,
      vehicleType: vehicle?.vehicleType || 'Desconocido',
      group: driver.group,
      operation: driver.operation,
      fuelType: fuelData?.fuelType || vehicle?.fuelType || 'Desconocido',
      period: metrics?.period,
      distanceKm: C.round(dist, 0),
      drivingHours: C.round(metrics?.drivingHours || 0, 1),
      engineHours: C.round(metrics?.engineHours || 0, 1),
      evaluationStatus,
      score: C.round(finalScore, 1),
      safetyScore: C.round(safetyResult.score, 1),
      efficiencyScore: C.round(efficiencyResult.score, 1),
      safety: safetyResult,
      efficiency: efficiencyResult,
      breakdown,
      statusLabel: status.label,
      statusColor: status.color,
      statusBg: status.bg
    };
  }

  /** Construye tabla de impactos para la pantalla Score Breakdown. */
  function buildBreakdown(finalScore, safetyResult, efficiencyResult) {
    const sc = safetyResult.components;
    const ec = efficiencyResult.components;

    // Calculamos el impacto de cada componente comparando contra score de 100 base
    function impact(comp, parentWeight) {
      const maxWeighted = 100 * comp.weight * parentWeight;
      const actualWeighted = comp.score * comp.weight * parentWeight;
      return C.round(actualWeighted - maxWeighted, 1);
    }

    const pw_s = safetyResult.weight;
    const pw_e = efficiencyResult.weight;

    return {
      baseScore: 100,
      items: [
        { label: 'Exceso de Velocidad',    key: 'speeding',          impact: impact(sc.speeding, pw_s),          per100km: sc.speeding.per100km,          score: sc.speeding.score },
        { label: 'Frenadas Bruscas',       key: 'harshBraking',      impact: impact(sc.harshBraking, pw_s),      per100km: sc.harshBraking.per100km,      score: sc.harshBraking.score },
        { label: 'Aceleraciones Bruscas',  key: 'harshAcceleration', impact: impact(sc.harshAcceleration, pw_s), per100km: sc.harshAcceleration.per100km, score: sc.harshAcceleration.score },
        { label: 'Curvas Agresivas',       key: 'harshCornering',    impact: impact(sc.harshCornering, pw_s),    per100km: sc.harshCornering.per100km,    score: sc.harshCornering.score },
        { label: 'Otros Eventos',          key: 'other',             impact: impact(sc.other, pw_s),             per100km: sc.other.per100km,             score: sc.other.score },
        { label: 'Ralentí',                key: 'idling',            impact: impact(ec.idling, pw_e),            value: `${ec.idling.idleRatePct}%`,      score: ec.idling.score },
        { label: 'Combustible',            key: 'fuel',              impact: impact(ec.fuel, pw_e),              value: `${ec.fuel.consumption || '—'} ${ec.fuel.consumptionUnit}`, score: ec.fuel.score },
        { label: 'Utilización',            key: 'utilization',       impact: impact(ec.utilization, pw_e),       value: `${ec.utilization.utilizationPct || '—'}%`, score: ec.utilization.score }
      ],
      finalScore: C.round(finalScore, 1)
    };
  }

  /** Retorna status label/color/bg según score. */
  function getStatus(score, config) {
    if (score === null || score === undefined) return { label: 'Sin Datos', color: '#94a3b8', bg: '#f1f5f9' };
    const statuses = config.status;
    for (const key of ['excellent', 'good', 'acceptable', 'improvable', 'critical']) {
      const s = statuses[key];
      if (score >= s.min && score <= s.max) return s;
    }
    return statuses.critical;
  }

  /** Procesa lista completa de conductores en un período. */
  function evaluateAll(driverDataArray, config) {
    return driverDataArray.map(d => evaluateDriver(d, config));
  }

  /** Calcula el score promedio de la flota. */
  function calcFleetScore(evaluatedDrivers) {
    const valid = evaluatedDrivers.filter(d => d.score !== null);
    return valid.length > 0 ? C.round(C.average(valid.map(d => d.score)), 1) : null;
  }

  return {
    evaluateDriver, evaluateAll, calcSafetyScore,
    calcEfficiencyScore, getStatus, calcFleetScore, buildBreakdown
  };
})();


/* DP360.Calc — Utilidades matemáticas y de normalización
 * Sin dependencias externas. Funciones puras.
 */
'use strict';
window.DP360 = window.DP360 || {};

DP360.Calc = (function () {

  /** Normaliza eventos por cada 100 km. Retorna 0 si distancia <= 0. */
  function normalizePerKm(events, distanceKm) {
    if (!distanceKm || distanceKm <= 0) return 0;
    return (events / distanceKm) * 100;
  }

  /** Busca el score en una tabla de umbrales {max, score} ordenada ascendente. */
  function scoreFromThresholds(value, thresholds) {
    if (value === null || value === undefined || isNaN(value)) return 0;
    for (const t of thresholds) {
      if (value <= t.max) return t.score;
    }
    return thresholds[thresholds.length - 1].score;
  }

  /** Score de utilización — tabla {min, score} ordenada descendente de min. */
  function scoreFromUtilThresholds(value, thresholds) {
    if (value === null || value === undefined || isNaN(value)) return 0;
    for (const t of thresholds) {
      if (value >= t.min) return t.score;
    }
    return thresholds[thresholds.length - 1].score;
  }

  /** Tasa de ralentí: (idleMinutes / (engineHours * 60)) * 100.
   *  Retorna 0 si engineHours es 0. */
  function calcIdleRate(idleMinutes, engineHours) {
    if (!engineHours || engineHours <= 0) return 0;
    const rate = (idleMinutes / (engineHours * 60)) * 100;
    return clamp(rate, 0, 100);
  }

  /** Consumo km/L. Retorna null si datos insuficientes. */
  function calcKmPerLiter(fuelUsed, distanceKm) {
    if (!fuelUsed || fuelUsed <= 0 || !distanceKm || distanceKm <= 0) return null;
    return distanceKm / fuelUsed;
  }

  /** Consumo km/m³ para GNV. */
  function calcKmPerM3(m3Used, distanceKm) {
    if (!m3Used || m3Used <= 0 || !distanceKm || distanceKm <= 0) return null;
    return distanceKm / m3Used;
  }

  /** Desviación porcentual: ((actual / benchmark) - 1) * 100.
   *  Negativo = peor que benchmark. Positivo = mejor.
   *  Para consumo de combustible: menor consumo = mejor (invertir).
   */
  function calcDeviationPct(actual, benchmark, lowerIsBetter) {
    if (!benchmark || benchmark <= 0 || actual === null || actual === undefined) return null;
    const raw = ((actual / benchmark) - 1) * 100;
    return lowerIsBetter ? -raw : raw;
  }

  /** Retorna el percentil p (0-100) de un array numérico. */
  function percentile(arr, p) {
    if (!arr || arr.length === 0) return null;
    const sorted = [...arr].filter(v => v !== null && v !== undefined && !isNaN(v)).sort((a, b) => a - b);
    if (sorted.length === 0) return null;
    const idx = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    if (lower === upper) return sorted[lower];
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
  }

  /** Media aritmética de un array. */
  function average(arr) {
    const valid = arr.filter(v => v !== null && v !== undefined && !isNaN(v));
    if (valid.length === 0) return null;
    return valid.reduce((s, v) => s + v, 0) / valid.length;
  }

  /** Restringe valor al rango [min, max]. */
  function clamp(value, min, max) {
    if (isNaN(value)) return min;
    return Math.min(Math.max(value, min), max);
  }

  /** Redondea a N decimales, retorna 0 si NaN. */
  function round(value, decimals) {
    if (value === null || value === undefined || isNaN(value)) return 0;
    return parseFloat(value.toFixed(decimals));
  }

  /** Formatea número con separadores de miles. */
  function formatNumber(n, decimals = 0) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    return Number(n).toLocaleString('es-EC', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  /** Formatea moneda. */
  function formatCurrency(amount, currency = 'USD') {
    if (amount === null || amount === undefined || isNaN(amount)) return '—';
    return new Intl.NumberFormat('es-EC', {
      style: 'currency', currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  /** Suma segura de arrays de métricas. */
  function sumMetrics(metricsArray, field) {
    return metricsArray.reduce((acc, m) => acc + (m[field] || 0), 0);
  }

  /** Diferencia en días entre dos fechas ISO. */
  function daysDiff(dateA, dateB) {
    const a = new Date(dateA), b = new Date(dateB);
    return Math.round((b - a) / 86400000);
  }

  /** Genera array de fechas ISO para últimas N semanas (lunes). */
  function lastNWeeks(n) {
    const weeks = [];
    const now = new Date();
    const day = now.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const thisMonday = new Date(now);
    thisMonday.setDate(now.getDate() + mondayOffset);
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(thisMonday);
      d.setDate(thisMonday.getDate() - i * 7);
      weeks.push(d.toISOString().slice(0, 10));
    }
    return weeks;
  }

  return {
    normalizePerKm, scoreFromThresholds, scoreFromUtilThresholds,
    calcIdleRate, calcKmPerLiter, calcKmPerM3, calcDeviationPct,
    percentile, average, clamp, round,
    formatNumber, formatCurrency, sumMetrics,
    daysDiff, lastNWeeks
  };
})();

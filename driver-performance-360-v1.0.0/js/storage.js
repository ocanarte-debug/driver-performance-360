
/* DP360.Storage — Persistencia en localStorage
 * Gestiona: configuración, mapeo de reglas, preferencias.
 */
'use strict';
window.DP360 = window.DP360 || {};

DP360.Storage = (function () {
  const PREFIX = 'dp360_';

  function _key(k) { return PREFIX + k; }

  function _get(k, def = null) {
    try {
      const raw = localStorage.getItem(_key(k));
      return raw !== null ? JSON.parse(raw) : def;
    } catch (e) { return def; }
  }

  function _set(k, v) {
    try { localStorage.setItem(_key(k), JSON.stringify(v)); return true; }
    catch (e) { console.warn('[DP360.Storage] Error escribiendo:', k, e); return false; }
  }

  function _del(k) {
    try { localStorage.removeItem(_key(k)); } catch (e) {}
  }

  /* ── Mapeo de Reglas ─────────────────────────────────────────────── */
  /**
   * Formato ruleMapping:
   * {
   *   default: { [ruleId]: 'harshBraking' | 'speeding' | ... | 'ignored' },
   *   'Camión': { [ruleId]: 'harshBraking' },
   *   ...
   * }
   */
  function getRuleMapping() {
    return _get('rule_mapping', { default: {} });
  }

  function setRuleMapping(mapping) {
    return _set('rule_mapping', mapping);
  }

  function setRuleCategory(ruleId, category, vehicleType = 'default') {
    const mapping = getRuleMapping();
    if (!mapping[vehicleType]) mapping[vehicleType] = {};
    if (category === null) {
      delete mapping[vehicleType][ruleId];
    } else {
      mapping[vehicleType][ruleId] = category;
    }
    return setRuleMapping(mapping);
  }

  function getRuleCategory(ruleId, vehicleType = 'default') {
    const mapping = getRuleMapping();
    // Busca primero por tipo, luego default
    return mapping[vehicleType]?.[ruleId] || mapping['default']?.[ruleId] || null;
  }

  function exportRuleMapping() {
    return JSON.stringify(getRuleMapping(), null, 2);
  }

  function importRuleMapping(jsonStr) {
    try {
      const parsed = JSON.parse(jsonStr);
      setRuleMapping(parsed);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  /* ── Config Override ─────────────────────────────────────────────── */
  function getConfigOverride() {
    return _get('config_override', null);
  }

  function setConfigOverride(config) {
    return _set('config_override', config);
  }

  function clearConfigOverride() {
    _del('config_override');
  }

  /* ── Preferencias de usuario ─────────────────────────────────────── */
  function getPreferences() {
    return _get('preferences', {
      useMockData: true,
      dateRange: 'last30',
      theme: 'light',
      currency: 'USD',
      fuelPricePerL: 0.98,
      fuelPricePerM3: 0.42
    });
  }

  function setPreferences(prefs) {
    const current = getPreferences();
    return _set('preferences', { ...current, ...prefs });
  }

  function setPreference(key, value) {
    const prefs = getPreferences();
    prefs[key] = value;
    return _set('preferences', prefs);
  }

  /* ── Coaching Plans ──────────────────────────────────────────────── */
  function getCoachingPlans() {
    return _get('coaching_plans', []);
  }

  function saveCoachingPlan(plan) {
    const plans = getCoachingPlans();
    const idx = plans.findIndex(p => p.id === plan.id);
    if (idx >= 0) plans[idx] = plan;
    else plans.push({ ...plan, id: plan.id || Date.now().toString() });
    return _set('coaching_plans', plans);
  }

  function deleteCoachingPlan(planId) {
    const plans = getCoachingPlans().filter(p => p.id !== planId);
    return _set('coaching_plans', plans);
  }

  /* ── Reset ───────────────────────────────────────────────────────── */
  function resetAll() {
    ['rule_mapping', 'config_override', 'preferences', 'coaching_plans'].forEach(_del);
  }

  return {
    getRuleMapping, setRuleMapping, setRuleCategory, getRuleCategory,
    exportRuleMapping, importRuleMapping,
    getConfigOverride, setConfigOverride, clearConfigOverride,
    getPreferences, setPreferences, setPreference,
    getCoachingPlans, saveCoachingPlan, deleteCoachingPlan,
    resetAll
  };
})();

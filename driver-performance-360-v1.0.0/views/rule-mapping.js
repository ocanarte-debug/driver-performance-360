/**
 * Driver Performance 360 — views/rule-mapping.js
 * Rule Mapping UI: assign MyGeotab exception rules to scoring categories.
 * Supports per-vehicle-type mappings via tabs.
 * Namespace: DP360.Views.RuleMapping
 * Version: 1.0.0
 */

(function (DP360) {
  'use strict';

  DP360.Views = DP360.Views || {};

  // Scoring categories a rule can be mapped to
  const CATEGORIES = [
    { id: 'speeding',           label: '🚨 Exceso velocidad',   group: 'safety'     },
    { id: 'harshBraking',       label: '⚠️ Frenado brusco',     group: 'safety'     },
    { id: 'harshAcceleration',  label: '⚡ Aceleración brusca', group: 'safety'     },
    { id: 'harshCornering',     label: '↩️ Giro brusco',        group: 'safety'     },
    { id: 'other',              label: '📋 Otro evento',        group: 'safety'     },
    { id: 'ignore',             label: '🚫 No contar',          group: 'ignore'     }
  ];

  // Vehicle types for tab switching
  const VEHICLE_TYPES = ['default', 'Camión', 'Camioneta', 'Vehículo Liviano', 'GNV'];

  let _rules       = [];
  let _activeType  = 'default';
  let _mapping     = {};
  let _searchText  = '';

  // ─── Main Render ──────────────────────────────────────────────────────────

  async function render() {
    // Load rules and current mapping
    _rules   = await DP360.API.getExceptionRules();
    _mapping = DP360.Storage ? DP360.Storage.getRuleMapping() : {};

    _renderToolbar();
    _renderTabs();
    _renderRuleList();
    _bindSearch();
  }

  // ─── Toolbar ──────────────────────────────────────────────────────────────

  function _renderToolbar() {
    const el = document.getElementById('rulemap-toolbar');
    if (!el) return;

    el.innerHTML = `
<div class="rulemap-toolbar">
  <div class="rulemap-search">
    <input type="text" id="rulemap-search" placeholder="Buscar regla por nombre…" class="filter-control">
  </div>
  <div class="rulemap-actions">
    <button class="btn btn-ghost btn-sm" id="btn-rulemap-import">📥 Importar JSON</button>
    <button class="btn btn-primary btn-sm" id="btn-rulemap-export">📤 Exportar JSON</button>
    <button class="btn btn-ghost btn-sm" id="btn-rulemap-reset">🔄 Restaurar defaults</button>
  </div>
</div>
<div class="rulemap-info">
  <p>Asigna cada regla de excepción de MyGeotab a una categoría de puntuación. Puedes tener asignaciones diferentes por tipo de vehículo.</p>
  <p><strong>Default:</strong> se aplica a todos los tipos si no hay asignación específica para ese tipo.</p>
</div>`;

    document.getElementById('btn-rulemap-export') &&
      (document.getElementById('btn-rulemap-export').onclick = _exportMapping);

    document.getElementById('btn-rulemap-import') &&
      (document.getElementById('btn-rulemap-import').onclick = _importMapping);

    document.getElementById('btn-rulemap-reset') &&
      (document.getElementById('btn-rulemap-reset').onclick = _resetToDefaults);
  }

  // ─── Tabs ─────────────────────────────────────────────────────────────────

  function _renderTabs() {
    const el = document.getElementById('rulemap-tabs');
    if (!el) return;

    el.innerHTML = VEHICLE_TYPES.map(vt => {
      const label = vt === 'default' ? 'Default (todos)' : vt;
      const overrideCount = _countOverrides(vt);
      const badge = overrideCount > 0 ? `<span class="tab-badge">${overrideCount}</span>` : '';
      return `<button class="tab-btn ${vt === _activeType ? 'active' : ''}" data-type="${vt}">
        ${label} ${badge}
      </button>`;
    }).join('');

    el.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        _activeType = this.dataset.type;
        _renderTabs();
        _renderRuleList();
      });
    });
  }

  function _countOverrides(vehicleType) {
    if (vehicleType === 'default') return Object.keys(_mapping.default || {}).length;
    return Object.keys(_mapping[vehicleType] || {}).length;
  }

  // ─── Rule List ────────────────────────────────────────────────────────────

  function _renderRuleList() {
    const el = document.getElementById('rulemap-list');
    if (!el) return;

    const filteredRules = _searchText
      ? _rules.filter(r => r.name.toLowerCase().includes(_searchText.toLowerCase()))
      : _rules;

    if (!filteredRules.length) {
      el.innerHTML = `<p class="no-data">${_rules.length === 0
        ? 'No se encontraron reglas de excepción en la base de datos.'
        : 'Sin resultados para la búsqueda.'
      }</p>`;
      return;
    }

    // Group by current assignment category
    const grouped = {};
    CATEGORIES.forEach(c => { grouped[c.id] = []; });
    grouped['__unassigned__'] = [];

    filteredRules.forEach(rule => {
      const cat = _resolveCategory(rule.id);
      if (cat && grouped[cat] !== undefined) {
        grouped[cat].push(rule);
      } else {
        grouped['__unassigned__'].push(rule);
      }
    });

    let html = '';

    // Unassigned first
    if (grouped['__unassigned__'].length) {
      html += _renderGroup('Sin asignar', grouped['__unassigned__'], null, true);
    }

    CATEGORIES.forEach(cat => {
      if (grouped[cat.id] && grouped[cat.id].length) {
        html += _renderGroup(cat.label, grouped[cat.id], cat.id, false);
      }
    });

    el.innerHTML = html || '<p class="no-data">Todas las reglas ya están asignadas.</p>';

    // Bind select dropdowns
    el.querySelectorAll('.rule-category-select').forEach(sel => {
      sel.addEventListener('change', function () {
        const ruleId = this.dataset.ruleId;
        const category = this.value || null;
        _setCategory(ruleId, category);
      });
    });
  }

  function _renderGroup(groupLabel, rules, categoryId, isWarning) {
    const icon = isWarning ? '⚠️' : '';
    const headerClass = isWarning ? 'group-header group-warning' : 'group-header';

    const rows = rules.map(rule => {
      const currentCat = _resolveCategory(rule.id);
      const isOverridden = _isOverrideForType(rule.id, _activeType);

      const options = `<option value="">— No asignar —</option>` +
        CATEGORIES.map(c =>
          `<option value="${c.id}" ${currentCat === c.id ? 'selected' : ''}>${c.label}</option>`
        ).join('');

      return `
<div class="rule-row ${isOverridden ? 'rule-overridden' : ''}">
  <div class="rule-info">
    <div class="rule-name">${_esc(rule.name)}</div>
    ${rule.comment ? `<div class="rule-comment">${_esc(rule.comment)}</div>` : ''}
    <div class="rule-id">ID: ${_esc(rule.id)}</div>
  </div>
  <div class="rule-assign">
    <select class="rule-category-select" data-rule-id="${rule.id}">
      ${options}
    </select>
    ${isOverridden ? `<span class="override-badge" title="Override específico para ${_activeType}">custom</span>` : ''}
  </div>
</div>`;
    }).join('');

    return `
<div class="rule-group">
  <div class="${headerClass}">${icon} ${_esc(groupLabel)} <span class="group-count">(${rules.length})</span></div>
  <div class="rule-group-body">${rows}</div>
</div>`;
  }

  // ─── Category Resolution ──────────────────────────────────────────────────

  function _resolveCategory(ruleId) {
    // vehicleType-specific takes priority
    const byType    = (_mapping[_activeType] || {})[ruleId];
    const byDefault = (_mapping['default']   || {})[ruleId];
    return byType || byDefault || null;
  }

  function _isOverrideForType(ruleId, vehicleType) {
    return vehicleType !== 'default' && !!(_mapping[vehicleType] || {})[ruleId];
  }

  function _setCategory(ruleId, category) {
    if (!_mapping[_activeType]) _mapping[_activeType] = {};

    if (!category) {
      delete _mapping[_activeType][ruleId];
    } else {
      _mapping[_activeType][ruleId] = category;
    }

    // Persist
    if (DP360.Storage) DP360.Storage.setRuleMapping(_mapping);

    // Refresh tabs badge counts
    _renderTabs();
    // Don't re-render the full list (too disruptive during editing)
  }

  // ─── Search ───────────────────────────────────────────────────────────────

  function _bindSearch() {
    const inp = document.getElementById('rulemap-search');
    if (!inp) return;
    inp.addEventListener('input', function () {
      _searchText = this.value.trim();
      _renderRuleList();
    });
  }

  // ─── Export / Import ──────────────────────────────────────────────────────

  function _exportMapping() {
    if (!DP360.Storage) return;
    const json = DP360.Storage.exportRuleMapping();
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `DP360_RuleMapping_${_dateStamp()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function _importMapping() {
    const input = document.createElement('input');
    input.type   = 'file';
    input.accept = '.json,application/json';
    input.onchange = function (e) {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function (ev) {
        try {
          if (!DP360.Storage) return;
          DP360.Storage.importRuleMapping(ev.target.result);
          _mapping = DP360.Storage.getRuleMapping();
          _renderTabs();
          _renderRuleList();
          _showToast('Mapeo importado correctamente ✅');
        } catch (err) {
          alert('Error al importar: ' + err.message);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  function _resetToDefaults() {
    if (!confirm('¿Restaurar el mapeo de reglas al valor predeterminado? Se perderán las asignaciones actuales.')) return;

    const defaultMapping = DP360.MockData ? DP360.MockData.getDefaultRuleMapping() : {};
    _mapping = defaultMapping;
    if (DP360.Storage) DP360.Storage.setRuleMapping(_mapping);
    _renderTabs();
    _renderRuleList();
    _showToast('Mapeo restaurado a valores predeterminados');
  }

  // ─── Toast ────────────────────────────────────────────────────────────────

  function _showToast(msg) {
    let toast = document.getElementById('dp360-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'dp360-toast';
      toast.className = 'dp360-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('toast-visible');
    setTimeout(() => toast.classList.remove('toast-visible'), 3000);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  function _dateStamp() {
    return new Date().toISOString().slice(0, 10).replace(/-/g, '');
  }

  function _esc(str) {
    return (str || '').replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));
  }

  DP360.Views.RuleMapping = { render };

})(window.DP360 = window.DP360 || {});

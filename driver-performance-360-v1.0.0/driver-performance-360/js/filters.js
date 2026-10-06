/**
 * Driver Performance 360 — filters.js
 * Global filter state, date range presets, filter rendering
 * Namespace: DP360.Filters
 * Version: 1.0.0
 */

(function (DP360) {
  'use strict';

  // ─── Filter State ─────────────────────────────────────────────────────────

  const DEFAULT_STATE = {
    dateFrom: null,
    dateTo: null,
    dateRange: 'last30',
    groups: [],        // [] = all groups
    vehicleTypes: [],  // [] = all types
    fuelTypes: [],     // [] = all fuel types
    minKm: 0,
    searchText: '',
    sortField: 'score',
    sortDir: 'asc'
  };

  let _state = Object.assign({}, DEFAULT_STATE);
  let _listeners = [];

  // ─── Date Range Presets ───────────────────────────────────────────────────

  const DATE_PRESETS = [
    { id: 'last7',   label: 'Últimos 7 días',  days: 7 },
    { id: 'last14',  label: 'Últimas 2 semanas', days: 14 },
    { id: 'last30',  label: 'Últimos 30 días',  days: 30 },
    { id: 'last60',  label: 'Últimos 60 días',  days: 60 },
    { id: 'last90',  label: 'Últimos 90 días',  days: 90 },
    { id: 'custom',  label: 'Personalizado',    days: null }
  ];

  function resolveDateRange(presetId, customFrom, customTo) {
    if (presetId === 'custom') {
      return {
        dateFrom: customFrom ? new Date(customFrom) : null,
        dateTo:   customTo  ? new Date(customTo)   : null
      };
    }
    const preset = DATE_PRESETS.find(p => p.id === presetId);
    if (!preset) return { dateFrom: null, dateTo: null };
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - preset.days);
    return { dateFrom: from, dateTo: now };
  }

  // ─── State Management ─────────────────────────────────────────────────────

  function getState() {
    return Object.assign({}, _state);
  }

  function setState(partial) {
    const prev = Object.assign({}, _state);
    Object.assign(_state, partial);

    // If dateRange changed (and not custom), auto-resolve dates
    if (partial.dateRange && partial.dateRange !== 'custom') {
      const resolved = resolveDateRange(partial.dateRange);
      _state.dateFrom = resolved.dateFrom;
      _state.dateTo   = resolved.dateTo;
    }

    // Persist to storage
    if (DP360.Storage) {
      const prefs = DP360.Storage.getPreferences();
      prefs.dateRange = _state.dateRange;
      DP360.Storage.setPreferences(prefs);
    }

    _notifyListeners(prev, Object.assign({}, _state));
  }

  function resetFilters() {
    const fresh = Object.assign({}, DEFAULT_STATE);
    const resolved = resolveDateRange(fresh.dateRange);
    fresh.dateFrom = resolved.dateFrom;
    fresh.dateTo   = resolved.dateTo;
    _state = fresh;
    _notifyListeners(null, Object.assign({}, _state));
  }

  function initFromPreferences() {
    let prefs = {};
    if (DP360.Storage) prefs = DP360.Storage.getPreferences();
    const dateRange = prefs.dateRange || 'last30';
    const resolved = resolveDateRange(dateRange);
    _state.dateRange = dateRange;
    _state.dateFrom  = resolved.dateFrom;
    _state.dateTo    = resolved.dateTo;
  }

  // ─── Listeners ────────────────────────────────────────────────────────────

  function onChange(fn) {
    _listeners.push(fn);
    return function unsubscribe() {
      _listeners = _listeners.filter(l => l !== fn);
    };
  }

  function _notifyListeners(prev, next) {
    _listeners.forEach(fn => {
      try { fn(next, prev); } catch (e) { console.error('[DP360.Filters] listener error', e); }
    });
  }

  // ─── Apply Filters to Driver Array ────────────────────────────────────────

  /**
   * Apply current filter state to an array of evaluated drivers.
   * @param {Array} drivers - Array of evaluated driver objects
   * @param {Object} [overrides] - Optional filter overrides (for one-off filtering)
   * @returns {Array} Filtered + sorted drivers
   */
  function applyFilters(drivers, overrides) {
    if (!Array.isArray(drivers)) return [];
    const f = overrides ? Object.assign({}, _state, overrides) : _state;

    let result = drivers.filter(d => {
      // Group filter
      if (f.groups && f.groups.length > 0) {
        if (!f.groups.includes(d.group)) return false;
      }
      // Vehicle type filter
      if (f.vehicleTypes && f.vehicleTypes.length > 0) {
        if (!f.vehicleTypes.includes(d.vehicleType)) return false;
      }
      // Fuel type filter
      if (f.fuelTypes && f.fuelTypes.length > 0) {
        if (!f.fuelTypes.includes(d.fuelType)) return false;
      }
      // Minimum km filter
      if (f.minKm > 0 && (d.distanceKm || 0) < f.minKm) return false;
      // Search text filter
      if (f.searchText && f.searchText.trim()) {
        const q = f.searchText.toLowerCase();
        const match = (d.driverName || '').toLowerCase().includes(q) ||
                      (d.vehicleId || '').toLowerCase().includes(q) ||
                      (d.group || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });

    // Sort
    if (f.sortField) {
      result = result.slice().sort((a, b) => {
        let va = _getField(a, f.sortField);
        let vb = _getField(b, f.sortField);
        if (typeof va === 'string') va = va.toLowerCase();
        if (typeof vb === 'string') vb = vb.toLowerCase();
        if (va < vb) return f.sortDir === 'asc' ? -1 : 1;
        if (va > vb) return f.sortDir === 'asc' ?  1 : -1;
        return 0;
      });
    }

    return result;
  }

  function _getField(obj, path) {
    return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : null), obj);
  }

  // ─── Summary Stats (for filter bar counters) ──────────────────────────────

  function getFilterSummary(allDrivers, filteredDrivers) {
    return {
      total: allDrivers.length,
      filtered: filteredDrivers.length,
      excluded: allDrivers.length - filteredDrivers.length,
      isFiltered: filteredDrivers.length < allDrivers.length
    };
  }

  // ─── Render Filters Bar ───────────────────────────────────────────────────

  /**
   * Build and inject the global filters bar into a container element.
   * @param {string} containerId - DOM id of the container
   * @param {Object} options - { groups[], vehicleTypes[], fuelTypes[], onApply() }
   */
  function renderFiltersBar(containerId, options) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const opts = options || {};
    const groups       = opts.groups       || [];
    const vehicleTypes = opts.vehicleTypes || [];
    const fuelTypes    = opts.fuelTypes    || [];
    const onApply      = opts.onApply      || function(){};

    container.innerHTML = _buildFiltersBarHTML(groups, vehicleTypes, fuelTypes);
    _bindFiltersBarEvents(containerId, onApply);
    _syncFiltersBarToState(containerId);
  }

  function _buildFiltersBarHTML(groups, vehicleTypes, fuelTypes) {
    const presetOptions = DATE_PRESETS.map(p =>
      `<option value="${p.id}">${p.label}</option>`
    ).join('');

    const groupOptions = groups.map(g =>
      `<option value="${g}">${g}</option>`
    ).join('');

    const typeOptions = vehicleTypes.map(t =>
      `<option value="${t}">${t}</option>`
    ).join('');

    const fuelOptions = fuelTypes.map(f =>
      `<option value="${f}">${f}</option>`
    ).join('');

    return `
<div class="filters-bar">
  <div class="filters-row">

    <!-- Date Range -->
    <div class="filter-group">
      <label class="filter-label">Período</label>
      <select class="filter-control" id="fb-dateRange">
        ${presetOptions}
      </select>
    </div>

    <!-- Custom dates (hidden unless custom selected) -->
    <div class="filter-group filter-custom-dates" id="fb-custom-dates" style="display:none">
      <label class="filter-label">Desde</label>
      <input type="date" class="filter-control" id="fb-dateFrom">
      <label class="filter-label">Hasta</label>
      <input type="date" class="filter-control" id="fb-dateTo">
    </div>

    <!-- Group -->
    <div class="filter-group" id="fb-groups-wrap" ${groups.length === 0 ? 'style="display:none"' : ''}>
      <label class="filter-label">Zona / Grupo</label>
      <select class="filter-control" id="fb-group">
        <option value="">Todos</option>
        ${groupOptions}
      </select>
    </div>

    <!-- Vehicle Type -->
    <div class="filter-group" id="fb-types-wrap" ${vehicleTypes.length === 0 ? 'style="display:none"' : ''}>
      <label class="filter-label">Tipo vehículo</label>
      <select class="filter-control" id="fb-vehicleType">
        <option value="">Todos</option>
        ${typeOptions}
      </select>
    </div>

    <!-- Fuel Type -->
    <div class="filter-group" id="fb-fuel-wrap" ${fuelTypes.length === 0 ? 'style="display:none"' : ''}>
      <label class="filter-label">Combustible</label>
      <select class="filter-control" id="fb-fuelType">
        <option value="">Todos</option>
        ${fuelOptions}
      </select>
    </div>

    <!-- Search -->
    <div class="filter-group filter-search">
      <label class="filter-label">Buscar</label>
      <input type="text" class="filter-control" id="fb-search" placeholder="Conductor, vehículo, zona…">
    </div>

    <!-- Actions -->
    <div class="filter-actions">
      <button class="btn btn-primary btn-sm" id="fb-apply">Aplicar</button>
      <button class="btn btn-ghost btn-sm" id="fb-reset">Limpiar</button>
    </div>

  </div>

  <!-- Filter summary chip -->
  <div class="filter-summary" id="fb-summary" style="display:none"></div>
</div>`;
  }

  function _bindFiltersBarEvents(containerId, onApply) {
    const $ = id => document.getElementById(id);

    const dateRangeEl   = $('fb-dateRange');
    const customDatesEl = $('fb-custom-dates');
    const dateFromEl    = $('fb-dateFrom');
    const dateToEl      = $('fb-dateTo');
    const groupEl       = $('fb-group');
    const typeEl        = $('fb-vehicleType');
    const fuelEl        = $('fb-fuelType');
    const searchEl      = $('fb-search');
    const applyBtn      = $('fb-apply');
    const resetBtn      = $('fb-reset');

    if (dateRangeEl) {
      dateRangeEl.addEventListener('change', function () {
        if (this.value === 'custom') {
          customDatesEl && (customDatesEl.style.display = '');
        } else {
          customDatesEl && (customDatesEl.style.display = 'none');
        }
      });
    }

    if (applyBtn) {
      applyBtn.addEventListener('click', function () {
        const dateRange = dateRangeEl ? dateRangeEl.value : 'last30';
        const partial = { dateRange };
        if (dateRange === 'custom') {
          partial.dateFrom = dateFromEl ? new Date(dateFromEl.value) : null;
          partial.dateTo   = dateToEl   ? new Date(dateToEl.value)   : null;
        }
        if (groupEl)  partial.groups       = groupEl.value  ? [groupEl.value]  : [];
        if (typeEl)   partial.vehicleTypes = typeEl.value   ? [typeEl.value]   : [];
        if (fuelEl)   partial.fuelTypes    = fuelEl.value   ? [fuelEl.value]   : [];
        if (searchEl) partial.searchText   = searchEl.value.trim();
        setState(partial);
        onApply(_state);
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        resetFilters();
        _syncFiltersBarToState(containerId);
        onApply(_state);
      });
    }

    // Enter key on search
    if (searchEl) {
      searchEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') applyBtn && applyBtn.click();
      });
    }
  }

  function _syncFiltersBarToState(containerId) {
    const $ = id => document.getElementById(id);
    const s = _state;

    const dateRangeEl = $('fb-dateRange');
    if (dateRangeEl) dateRangeEl.value = s.dateRange || 'last30';

    const customDatesEl = $('fb-custom-dates');
    if (customDatesEl) {
      customDatesEl.style.display = s.dateRange === 'custom' ? '' : 'none';
    }

    const dateFromEl = $('fb-dateFrom');
    if (dateFromEl && s.dateFrom) {
      dateFromEl.value = s.dateFrom.toISOString().slice(0, 10);
    }

    const dateToEl = $('fb-dateTo');
    if (dateToEl && s.dateTo) {
      dateToEl.value = s.dateTo.toISOString().slice(0, 10);
    }

    const groupEl = $('fb-group');
    if (groupEl) groupEl.value = (s.groups && s.groups.length === 1) ? s.groups[0] : '';

    const typeEl = $('fb-vehicleType');
    if (typeEl) typeEl.value = (s.vehicleTypes && s.vehicleTypes.length === 1) ? s.vehicleTypes[0] : '';

    const fuelEl = $('fb-fuelType');
    if (fuelEl) fuelEl.value = (s.fuelTypes && s.fuelTypes.length === 1) ? s.fuelTypes[0] : '';

    const searchEl = $('fb-search');
    if (searchEl) searchEl.value = s.searchText || '';
  }

  /**
   * Update the filter summary chip text.
   * Call after applying filters to keep UI in sync.
   */
  function updateFilterSummary(total, filtered) {
    const el = document.getElementById('fb-summary');
    if (!el) return;
    if (filtered < total) {
      el.style.display = '';
      el.textContent = `Mostrando ${filtered} de ${total} conductores`;
    } else {
      el.style.display = 'none';
    }
  }

  // ─── Sort Helper ──────────────────────────────────────────────────────────

  function setSort(field, dir) {
    setState({ sortField: field, sortDir: dir || 'asc' });
  }

  function toggleSort(field) {
    if (_state.sortField === field) {
      setState({ sortDir: _state.sortDir === 'asc' ? 'desc' : 'asc' });
    } else {
      setState({ sortField: field, sortDir: 'asc' });
    }
  }

  // ─── Format helpers for display ───────────────────────────────────────────

  function formatDateRange(state) {
    const s = state || _state;
    if (s.dateFrom && s.dateTo) {
      const fmt = d => d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
      return `${fmt(s.dateFrom)} — ${fmt(s.dateTo)}`;
    }
    const preset = DATE_PRESETS.find(p => p.id === s.dateRange);
    return preset ? preset.label : 'Período no definido';
  }

  // ─── Export ───────────────────────────────────────────────────────────────

  DP360.Filters = {
    // State
    getState,
    setState,
    resetFilters,
    initFromPreferences,
    onChange,

    // Apply
    applyFilters,
    getFilterSummary,

    // UI
    renderFiltersBar,
    updateFilterSummary,

    // Sort
    setSort,
    toggleSort,

    // Utils
    formatDateRange,
    resolveDateRange,
    DATE_PRESETS
  };

})(window.DP360 = window.DP360 || {});

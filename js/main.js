/**
 * Driver Performance 360 — main.js
 * App controller: initialization, SPA routing, data loading orchestration.
 * Namespace: DP360.App
 * Version: 1.0.0
 */

(function (DP360) {
  'use strict';

  // ─── App State ────────────────────────────────────────────────────────────

  const state = {
    initialized:      false,
    loading:          false,
    allDrivers:       [],  // raw evaluated drivers (full date range)
    filteredDrivers:  [],  // after applying filters
    scoringConfig:    null,
    benchmarks:       null,
    dynamicBenchmarks: null,
    currentView:      'fleet',
    selectedDriverId: null,
    metaOptions:      { groups: [], vehicleTypes: [], fuelTypes: [] }
  };

  // ─── Entry Point (called by MyGeotab or demo loader) ─────────────────────

  /**
   * Initialize the Add-In.
   * @param {Object|null} api   - Geotab api object (null in demo mode)
   * @param {Object|null} st    - Geotab state object
   */
  async function init(api, st) {
    if (state.initialized) return;
    state.initialized = true;
    console.log('[DP360] init() called — api:', api ? 'live' : 'demo/mock');

    try {
      // Inject API context
      if (api) DP360.API.setContext(api, st);

      // Init filters from stored preferences
      DP360.Filters.initFromPreferences();

      // Load scoring config
      state.scoringConfig = await _loadScoringConfig();

      // Register filter change listener → refresh filtered view
      DP360.Filters.onChange(function () {
        _applyFiltersAndRender();
      });

      // Build navigation
      _buildNav();

      // Load data
      await _loadData();

      // Route to default view
      _navigateTo('fleet');

    } catch (err) {
      console.error('[DP360] Init error:', err);
      _showGlobalError('Error al inicializar el Add-In: ' + (err.message || err));
    }
  }

  // ─── Data Loading ─────────────────────────────────────────────────────────

  async function _loadData(silent) {
    if (state.loading) return;
    state.loading = true;
    if (!silent) _showLoadingOverlay(true);

    try {
      const filters = DP360.Filters.getState();
      const dateFrom = filters.dateFrom || _defaultDateFrom();
      const dateTo   = filters.dateTo   || new Date();

      // Load raw metrics
      const metrics = await DP360.API.loadAllMetrics(dateFrom, dateTo);

      // Evaluate all drivers
      state.allDrivers = DP360.ScoreEngine.evaluateAll(metrics, state.scoringConfig);

      // Compute dynamic benchmarks
      if (state.allDrivers.length >= 5) {
        state.dynamicBenchmarks = DP360.Benchmarks.calcFleetBenchmarks(
          state.allDrivers, state.scoringConfig
        );
      }

      // Load metadata for filter dropdowns (one-time)
      if (!state.metaOptions.groups.length) {
        const [groups, types, fuels] = await Promise.all([
          DP360.API.getAvailableGroups(),
          DP360.API.getAvailableVehicleTypes(),
          DP360.API.getAvailableFuelTypes()
        ]);
        state.metaOptions = { groups, vehicleTypes: types, fuelTypes: fuels };
      }

      // Apply current filters
      _applyFiltersAndRender();

    } catch (err) {
      console.error('[DP360] Data load error:', err);
      _showGlobalError('Error al cargar datos: ' + (err.message || err));
    } finally {
      state.loading = false;
      _showLoadingOverlay(false);
    }
  }

  function _applyFiltersAndRender() {
    state.filteredDrivers = DP360.Filters.applyFilters(state.allDrivers);
    _renderCurrentView();
    _updateFilterSummaryChip();
  }

  // ─── Navigation ───────────────────────────────────────────────────────────

  const VIEWS = {
    fleet:       { label: 'Resumen Flota',    icon: '🏠', render: _renderFleet       },
    ranking:     { label: 'Ranking',           icon: '🏆', render: _renderRanking     },
    driver:      { label: 'Perfil 360',        icon: '👤', render: _renderDriver360   },
    safety:      { label: 'Seguridad',         icon: '🛡️', render: _renderSafety      },
    fuel:        { label: 'Combustible',       icon: '⛽', render: _renderFuel        },
    improvement: { label: 'Mejora',            icon: '📈', render: _renderImprovement },
    coaching:    { label: 'Coaching',          icon: '🎯', render: _renderCoaching    },
    'rule-map':  { label: 'Reglas',            icon: '⚙️', render: _renderRuleMapping }
  };

  function _buildNav() {
    const navEl = document.getElementById('dp360-nav');
    if (!navEl) return;

    navEl.innerHTML = Object.entries(VIEWS).map(([id, view]) =>
      `<button class="nav-btn" data-view="${id}" title="${view.label}">
         <span class="nav-icon">${view.icon}</span>
         <span class="nav-label">${view.label}</span>
       </button>`
    ).join('');

    navEl.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-view]');
      if (!btn) return;
      _navigateTo(btn.dataset.view);
    });
  }

  function _navigateTo(viewId, params) {
    if (!VIEWS[viewId]) return;
    state.currentView = viewId;

    // Update nav active state
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewId);
    });

    // Show/hide containers
    document.querySelectorAll('.view-container').forEach(el => {
      el.style.display = el.dataset.view === viewId ? '' : 'none';
    });

    if (params) Object.assign(state, params);
    _renderCurrentView();
  }

  function _renderCurrentView() {
    const view = VIEWS[state.currentView];
    if (view && typeof view.render === 'function') {
      try {
        view.render();
      } catch (err) {
        console.error('[DP360] Render error in', state.currentView, err);
      }
    }
  }

  // ─── View Renderers (delegates to view modules) ───────────────────────────

  function _renderFleet() {
    if (DP360.Views && DP360.Views.Fleet) {
      DP360.Views.Fleet.render(state.filteredDrivers, state.dynamicBenchmarks, state.scoringConfig);
    }
  }

  function _renderRanking() {
    if (DP360.Views && DP360.Views.Ranking) {
      DP360.Views.Ranking.render(state.filteredDrivers, state.scoringConfig);
    }
  }

  function _renderDriver360() {
    if (DP360.Views && DP360.Views.Driver) {
      const driver = state.allDrivers.find(d => d.driverId === state.selectedDriverId)
                  || state.filteredDrivers[0]
                  || null;
      DP360.Views.Driver.render(driver, state.filteredDrivers, state.scoringConfig);
    }
  }

  function _renderSafety() {
    if (DP360.Views && DP360.Views.Safety) {
      DP360.Views.Safety.render(state.filteredDrivers, state.scoringConfig);
    }
  }

  function _renderFuel() {
    if (DP360.Views && DP360.Views.Fuel) {
      DP360.Views.Fuel.render(state.filteredDrivers, state.scoringConfig);
    }
  }

  function _renderImprovement() {
    if (DP360.Views && DP360.Views.Improvement) {
      DP360.Views.Improvement.render(state.filteredDrivers, state.allDrivers, state.scoringConfig);
    }
  }

  function _renderCoaching() {
    if (DP360.Views && DP360.Views.Coaching) {
      DP360.Views.Coaching.render(state.filteredDrivers, state.scoringConfig);
    }
  }

  function _renderRuleMapping() {
    if (DP360.Views && DP360.Views.RuleMapping) {
      DP360.Views.RuleMapping.render();
    }
  }

  // ─── Public: navigate to driver profile ───────────────────────────────────

  function openDriverProfile(driverId) {
    state.selectedDriverId = driverId;
    _navigateTo('driver');
  }

  // ─── Refresh ──────────────────────────────────────────────────────────────

  async function refresh() {
    await _loadData();
  }

  // ─── Filter summary chip (in filter bar) ──────────────────────────────────

  function _updateFilterSummaryChip() {
    DP360.Filters.updateFilterSummary(state.allDrivers.length, state.filteredDrivers.length);
  }

  // ─── Scoring Config Loader ────────────────────────────────────────────────

  async function _loadScoringConfig() {
    try {
      // Try to load from same origin (works in a local file server or Geotab hosting)
      const url = _resolveConfigUrl('config/scoring.json');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      try {
        const resp = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        if (resp.ok) return await resp.json();
      } catch (fetchErr) {
        clearTimeout(timeout);
        if (fetchErr.name !== 'AbortError') console.warn('[DP360] scoring.json fetch failed:', fetchErr.message);
        else console.warn('[DP360] scoring.json fetch timed out — using inline defaults');
      }
    } catch (e) { /* fall through */ }
    // Fallback: inline defaults (copy of scoring.json essentials)
    console.info('[DP360] Using inline default scoring config');
    return _defaultScoringConfig();
  }

  function _resolveConfigUrl(path) {
    // Resolve relative to the Add-In's own script location
    const scripts = document.querySelectorAll('script[src]');
    for (const s of scripts) {
      if (s.src && s.src.includes('main.js')) {
        return s.src.replace('js/main.js', path);
      }
    }
    return path;
  }

  function _defaultScoringConfig() {
    // Structure MUST match what ScoreEngine expects:
    //   config.safety       → component weights for safety
    //   config.efficiency   → component weights for efficiency
    //   config.weights      → parent weights (safety vs efficiency)
    //   config.thresholds   → scoring tables
    //   config.status       → status bands (each entry needs min AND max)
    return {
      version: '1.0.0-inline',
      weights: { safety: 0.60, efficiency: 0.40 },
      // Component weights — used directly as config.safety / config.efficiency in ScoreEngine
      safety: {
        speeding: 0.25, harshBraking: 0.25,
        harshAcceleration: 0.20, harshCornering: 0.15, other: 0.15
      },
      efficiency: {
        idling: 0.40, fuel: 0.45, utilization: 0.15
      },
      minimumKm: 500,
      provisionalKm: 100,
      utilizationEnabled: false,
      thresholds: {
        speeding: [
          { max: 0.30, score: 100 }, { max: 0.60, score: 92 }, { max: 1.0, score: 80 },
          { max: 2.0, score: 65 }, { max: 4.0, score: 45 }, { max: 7.0, score: 25 },
          { max: 9999, score: 10 }
        ],
        harshBraking: [
          { max: 0.5, score: 100 }, { max: 1.0, score: 90 }, { max: 2.0, score: 75 },
          { max: 4.0, score: 55 }, { max: 6.0, score: 35 }, { max: 9999, score: 10 }
        ],
        harshAcceleration: [
          { max: 0.5, score: 100 }, { max: 1.0, score: 90 }, { max: 2.0, score: 75 },
          { max: 4.0, score: 55 }, { max: 6.0, score: 35 }, { max: 9999, score: 10 }
        ],
        harshCornering: [
          { max: 1.0, score: 100 }, { max: 2.0, score: 85 }, { max: 4.0, score: 65 },
          { max: 7.0, score: 40 }, { max: 9999, score: 15 }
        ],
        other: [
          { max: 1.0, score: 100 }, { max: 2.0, score: 85 }, { max: 4.0, score: 65 },
          { max: 9999, score: 40 }
        ],
        idling: [
          { max: 5, score: 100 }, { max: 10, score: 85 }, { max: 15, score: 65 },
          { max: 20, score: 45 }, { max: 25, score: 25 }, { max: 9999, score: 10 }
        ],
        fuelDeviation: [
          { max: 5, score: 100 }, { max: 10, score: 85 }, { max: 15, score: 65 },
          { max: 25, score: 45 }, { max: 9999, score: 20 }
        ],
        utilization: [
          { min: 80, score: 100 }, { min: 70, score: 85 }, { min: 55, score: 65 },
          { min: 40, score: 45 }, { min: 0, score: 20 }
        ]
      },
      status: {
        excellent:  { min: 90, max: 100, label: 'Excelente',  color: '#10b981', bg: '#d1fae5' },
        good:       { min: 80, max: 89,  label: 'Bueno',      color: '#3b82f6', bg: '#dbeafe' },
        acceptable: { min: 70, max: 79,  label: 'Aceptable',  color: '#f59e0b', bg: '#fef3c7' },
        improvable: { min: 60, max: 69,  label: 'Mejorable',  color: '#f97316', bg: '#ffedd5' },
        critical:   { min: 0,  max: 59,  label: 'Crítico',    color: '#ef4444', bg: '#fee2e2' }
      }
    };
  }

  // ─── UI Helpers ───────────────────────────────────────────────────────────

  function _showLoadingOverlay(show) {
    const el = document.getElementById('dp360-loading');
    if (el) el.style.display = show ? 'flex' : 'none';
  }

  function _showGlobalError(msg) {
    _showLoadingOverlay(false);
    const el = document.getElementById('dp360-error');
    if (el) {
      el.style.display = '';
      const msgEl = el.querySelector('.error-message');
      if (msgEl) msgEl.textContent = msg;
    } else {
      alert('[DP360 Error] ' + msg);
    }
  }

  function _defaultDateFrom() {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  }

  // ─── Mock Mode Toggle (exposed to UI) ─────────────────────────────────────

  function toggleMockMode(useMock) {
    if (DP360.Storage) {
      const prefs = DP360.Storage.getPreferences();
      prefs.useMockData = useMock;
      DP360.Storage.setPreferences(prefs);
    }
    state.initialized = false;
    state.allDrivers  = [];
    _loadData();
  }

  // ─── Geotab Add-In Entry Point ────────────────────────────────────────────

  /**
   * Standard Geotab Add-In registration.
   * Exposed as window.DriverPerformance360 for manifest.json "page" entry.
   */
  window.DriverPerformance360 = function (api, state_geotab) {
    return {
      initialize: function (geoApi, geoState, callback) {
        init(geoApi, geoState).then(function () {
          if (typeof callback === 'function') callback();
        });
      },
      focus: function () { /* called when user returns to Add-In tab */ },
      blur:  function () { DP360.Charts.destroyAll(); }
    };
  };

  // ─── Export ───────────────────────────────────────────────────────────────

  DP360.App = {
    init,
    refresh,
    openDriverProfile,
    toggleMockMode,
    getState: function () { return Object.assign({}, state); },
    navigateTo: _navigateTo
  };

  // ─── Global error safety net ──────────────────────────────────────────────

  window.addEventListener('error', function (e) {
    console.error('[DP360] Uncaught error:', e.message, 'at', e.filename, e.lineno);
  });
  window.addEventListener('unhandledrejection', function (e) {
    console.error('[DP360] Unhandled promise rejection:', e.reason);
  });

  // ─── Auto-init in demo mode (no MyGeotab context) ─────────────────────────

  document.addEventListener('DOMContentLoaded', function () {
    // Only auto-init if not inside a Geotab frame.
    // window.geotab.addin is the MyGeotab Add-In manager — only truthy inside MyGeotab.
    const inGeotab = !!(window.geotab && typeof window.geotab.addin === 'function');
    console.log('[DP360] DOMContentLoaded — inGeotab:', inGeotab);
    if (!inGeotab) {
      init(null, null);
    }
  });

})(window.DP360 = window.DP360 || {});

/**
 * Driver Performance 360 — views/fleet.js
 * Fleet Overview: KPIs, score trend, top/bottom 10, status distribution.
 * Namespace: DP360.Views.Fleet
 * Version: 1.0.0
 */

(function (DP360) {
  'use strict';

  DP360.Views = DP360.Views || {};

  function render(drivers, dynamicBenchmarks, config) {
    _renderFiltersBar();
    _renderKPIs(drivers, dynamicBenchmarks);
    _renderStatusDoughnut(drivers);
    _renderTopBottom(drivers);
    _renderFleetTrend(drivers);
  }

  // ─── Filters Bar ─────────────────────────────────────────────────────────

  function _renderFiltersBar() {
    if (!DP360.Filters) return;
    DP360.Filters.renderFiltersBar('fleet-filters', {
      groups:       DP360.App ? DP360.App.getState().metaOptions.groups       : [],
      vehicleTypes: DP360.App ? DP360.App.getState().metaOptions.vehicleTypes : [],
      fuelTypes:    DP360.App ? DP360.App.getState().metaOptions.fuelTypes    : [],
      onApply:      function () { DP360.App && DP360.App.refresh && DP360.App.getState(); }
    });
  }

  // ─── KPI Cards ────────────────────────────────────────────────────────────

  function _renderKPIs(drivers, dynamicBenchmarks) {
    const container = document.getElementById('fleet-kpis');
    if (!container) return;

    if (!drivers || drivers.length === 0) {
      container.innerHTML = '<p class="no-data">Sin datos para el período seleccionado.</p>';
      return;
    }

    const eligible   = drivers.filter(d => d.evaluationStatus !== 'insufficient');
    const fleetScore = eligible.length > 0
      ? Math.round(eligible.reduce((s, d) => s + d.score, 0) / eligible.length)
      : 0;

    const critical   = eligible.filter(d => d.score < 40).length;
    const improvable = eligible.filter(d => d.score >= 40 && d.score < 60).length;
    const excellent  = eligible.filter(d => d.score >= 90).length;

    const totalKm    = drivers.reduce((s, d) => s + (d.distanceKm || 0), 0);
    const evaluated  = eligible.length;

    const p50 = dynamicBenchmarks && dynamicBenchmarks.overall
      ? dynamicBenchmarks.overall.p50 : null;

    container.innerHTML = `
<div class="kpi-grid">
  ${_kpi('Puntaje Flota', fleetScore, 'pts', _scoreColor(fleetScore), 'score-big')}
  ${_kpi('Conductores Evaluados', evaluated, `de ${drivers.length}`, '#3b82f6')}
  ${_kpi('Críticos', critical, 'conductores', critical > 0 ? '#ef4444' : '#10b981')}
  ${_kpi('Improvable', improvable, 'conductores', improvable > 0 ? '#f97316' : '#10b981')}
  ${_kpi('Excelentes', excellent, 'conductores', '#10b981')}
  ${_kpi('Km Total', _fmt(Math.round(totalKm)), 'km', '#6366f1')}
  ${p50 !== null ? _kpi('Mediana (P50)', Math.round(p50), 'pts', '#8b5cf6') : ''}
</div>`;
  }

  function _kpi(label, value, unit, color, extraClass) {
    return `
<div class="kpi-card ${extraClass || ''}">
  <div class="kpi-value" style="color:${color}">${value}</div>
  <div class="kpi-unit">${unit}</div>
  <div class="kpi-label">${label}</div>
</div>`;
  }

  // ─── Status Doughnut ─────────────────────────────────────────────────────

  function _renderStatusDoughnut(drivers) {
    DP360.Charts.renderStatusDoughnut('chart-fleet-status', drivers);
  }

  // ─── Top / Bottom 10 ─────────────────────────────────────────────────────

  function _renderTopBottom(drivers) {
    const eligible = drivers.filter(d => d.evaluationStatus !== 'insufficient');

    const sorted = eligible.slice().sort((a, b) => b.score - a.score);
    const top10  = sorted.slice(0, 10);
    const bot10  = sorted.slice(-10).reverse();

    _renderDriverList('fleet-top10',  top10,  true);
    _renderDriverList('fleet-bot10',  bot10,  false);

    DP360.Charts.renderTopDriversBar('chart-top10',  top10,  'Top 10');
    DP360.Charts.renderTopDriversBar('chart-bot10',  bot10,  'Requieren atención');
  }

  function _renderDriverList(containerId, drivers, isTop) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!drivers.length) {
      container.innerHTML = '<p class="no-data">Sin datos</p>';
      return;
    }

    const rows = drivers.map((d, i) => `
<tr class="clickable-row" data-driver-id="${d.driverId}">
  <td class="rank-cell">${i + 1}</td>
  <td>${_esc(d.driverName)}</td>
  <td>${_esc(d.group || '—')}</td>
  <td>${_esc(d.vehicleType)}</td>
  <td><span class="score-badge" style="background:${d.statusColor || '#6b7280'}">${Math.round(d.score)}</span></td>
  <td><span class="status-chip" style="color:${d.statusColor}">${d.statusLabel}</span></td>
</tr>`).join('');

    container.innerHTML = `
<table class="data-table">
  <thead>
    <tr>
      <th>#</th><th>Conductor</th><th>Zona</th><th>Tipo</th><th>Puntaje</th><th>Estado</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>`;

    // Click row → open driver profile
    container.querySelectorAll('.clickable-row').forEach(row => {
      row.addEventListener('click', function () {
        DP360.App && DP360.App.openDriverProfile(this.dataset.driverId);
      });
    });
  }

  // ─── Fleet Trend ──────────────────────────────────────────────────────────

  function _renderFleetTrend(drivers) {
    if (!DP360.MockData || !DP360.API.isMockMode()) {
      // Trend only available in mock mode (weekly snapshots)
      document.getElementById('fleet-trend-section') &&
        (document.getElementById('fleet-trend-section').style.display = 'none');
      return;
    }

    const weeks = DP360.MockData.getAvailableWeeks();
    const config = DP360.App ? DP360.App.getState().scoringConfig : null;

    // Average score per week across all drivers
    const avgScores = weeks.map(w => {
      const metrics = DP360.MockData.getMetrics(w.from, w.to);
      if (!metrics.length) return null;
      const evaluated = DP360.ScoreEngine.evaluateAll(metrics, config);
      const eligible  = evaluated.filter(d => d.evaluationStatus !== 'insufficient');
      if (!eligible.length) return null;
      return DP360.Calc.round(eligible.reduce((s, d) => s + d.score, 0) / eligible.length, 1);
    });

    const validWeeks  = weeks.filter((_, i) => avgScores[i] !== null);
    const validScores = avgScores.filter(s => s !== null);

    DP360.Charts.renderScoreTrend(
      'chart-fleet-trend',
      validWeeks.map(w => w.label),
      validScores
    );
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  function _scoreColor(score) {
    if (score >= 90) return '#10b981';
    if (score >= 75) return '#22c55e';
    if (score >= 60) return '#f59e0b';
    if (score >= 40) return '#f97316';
    return '#ef4444';
  }

  function _fmt(n) {
    return (n || 0).toLocaleString('es-EC');
  }

  function _esc(str) {
    return (str || '').replace(/[<>&"']/g, c => ({
      '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  DP360.Views.Fleet = { render };

})(window.DP360 = window.DP360 || {});

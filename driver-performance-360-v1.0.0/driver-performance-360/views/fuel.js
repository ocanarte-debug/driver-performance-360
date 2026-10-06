/**
 * Driver Performance 360 — views/fuel.js
 * Fuel & Idling view (includes GNV section).
 * Namespace: DP360.Views.Fuel
 * Version: 1.0.0
 */

(function (DP360) {
  'use strict';

  DP360.Views = DP360.Views || {};

  function render(drivers, config) {
    const eligible = drivers.filter(d => d.evaluationStatus !== 'insufficient');
    _renderKPIs(eligible);
    _renderFuelChart(eligible);
    _renderIdleChart(eligible);
    _renderGNVSection(eligible);
    _renderFuelTable(eligible);
  }

  function _renderKPIs(drivers) {
    const el = document.getElementById('fuel-kpis');
    if (!el) return;
    if (!drivers.length) { el.innerHTML = '<p class="no-data">Sin datos.</p>'; return; }

    const avgEff = _avg(drivers.map(d => d.efficiencyScore || 0));
    const avgIdle = _avg(drivers
      .filter(d => d.efficiency && d.efficiency.idling)
      .map(d => d.efficiency.idling.idleRatePct || 0));

    const liquidDrivers = drivers.filter(d => d.fuelType !== 'GNV' && d.efficiency && d.efficiency.fuel);
    const gnvDrivers    = drivers.filter(d => d.fuelType === 'GNV'  && d.efficiency && d.efficiency.fuel);

    const avgLiquid = liquidDrivers.length
      ? _avg(liquidDrivers.map(d => d.efficiency.fuel.consumption || 0)) : null;
    const avgGNV = gnvDrivers.length
      ? _avg(gnvDrivers.map(d => d.efficiency.fuel.consumption || 0)) : null;

    const highIdle = drivers.filter(d => d.efficiency && d.efficiency.idling &&
      d.efficiency.idling.idleRatePct > 20).length;

    el.innerHTML = `
<div class="kpi-grid">
  ${_kpi('Score Eficiencia Flota', Math.round(avgEff), 'pts', _scoreColor(avgEff))}
  ${_kpi('Ralentí Promedio', avgIdle.toFixed(1) + '%', 'del tiempo motor', _idleColor(avgIdle))}
  ${avgLiquid !== null ? _kpi('Consumo Promedio', avgLiquid.toFixed(2) + ' km/L', 'Diesel/Gasolina', '#6366f1') : ''}
  ${avgGNV    !== null ? _kpi('Consumo GNV Prom.', avgGNV.toFixed(2) + ' km/m³', 'Gas Natural',     '#10b981') : ''}
  ${_kpi('Alto Ralentí (>20%)', highIdle, 'conductores', highIdle > 0 ? '#f97316' : '#10b981')}
</div>`;
  }

  function _renderFuelChart(drivers) {
    const liquid = drivers.filter(d => d.fuelType !== 'GNV');
    const gnv    = drivers.filter(d => d.fuelType === 'GNV');

    if (liquid.length) DP360.Charts.renderFuelComparison('chart-fuel-liquid', liquid, null);
    if (gnv.length)    DP360.Charts.renderFuelComparison('chart-fuel-gnv',    gnv,   'GNV');

    // Show/hide GNV section
    const gnvSection = document.getElementById('fuel-gnv-chart-section');
    if (gnvSection) gnvSection.style.display = gnv.length ? '' : 'none';
  }

  function _renderIdleChart(drivers) {
    DP360.Charts.renderIdleScatter('chart-idle-scatter', drivers);
  }

  function _renderGNVSection(drivers) {
    const el = document.getElementById('fuel-gnv-section');
    const gnvDrivers = drivers.filter(d => d.fuelType === 'GNV');

    if (!el) return;
    if (!gnvDrivers.length) { el.style.display = 'none'; return; }
    el.style.display = '';

    const rows = gnvDrivers
      .sort((a, b) => (b.efficiency && b.efficiency.fuel ? b.efficiency.fuel.consumption : 0) -
                      (a.efficiency && a.efficiency.fuel ? a.efficiency.fuel.consumption : 0))
      .map(d => {
        const fuel  = (d.efficiency || {}).fuel || {};
        const score = fuel.score !== undefined ? Math.round(fuel.score) : '—';
        return `
<tr class="clickable-row" data-driver-id="${d.driverId}">
  <td>${_esc(d.driverName)}</td>
  <td>${_esc(d.vehicleType)}</td>
  <td>${Math.round(d.distanceKm || 0).toLocaleString('es-EC')} km</td>
  <td>${fuel.totalUsed !== undefined ? fuel.totalUsed.toFixed(1) + ' m³' : '—'}</td>
  <td>${fuel.consumption !== undefined ? fuel.consumption.toFixed(2) + ' km/m³' : '—'}</td>
  <td>${fuel.deviationPct !== undefined ? (fuel.deviationPct >= 0 ? '+' : '') + fuel.deviationPct.toFixed(1) + '%' : '—'}</td>
  <td><span class="score-badge" style="background:${_scoreColor(typeof score === 'number' ? score : 50)}">${score}</span></td>
</tr>`;
      }).join('');

    const tableEl = el.querySelector('#gnv-table');
    if (tableEl) {
      tableEl.innerHTML = `
<table class="data-table">
  <thead>
    <tr>
      <th>Conductor</th><th>Tipo</th><th>Km</th><th>m³ consumidos</th>
      <th>km/m³</th><th>Desv. benchmark</th><th>Score</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>`;
      tableEl.querySelectorAll('.clickable-row').forEach(row => {
        row.style.cursor = 'pointer';
        row.addEventListener('click', function () {
          DP360.App && DP360.App.openDriverProfile(this.dataset.driverId);
        });
      });
    }
  }

  function _renderFuelTable(drivers) {
    const el = document.getElementById('fuel-table-wrap');
    if (!el) return;

    const liquid = drivers.filter(d => d.fuelType !== 'GNV')
      .sort((a, b) => (a.efficiency && a.efficiency.fuel ? a.efficiency.fuel.score : 0) -
                      (b.efficiency && b.efficiency.fuel ? b.efficiency.fuel.score : 0));

    if (!liquid.length) { el.innerHTML = ''; return; }

    const rows = liquid.map(d => {
      const fuel = (d.efficiency || {}).fuel || {};
      const idle = (d.efficiency || {}).idling || {};
      const score = fuel.score !== undefined ? Math.round(fuel.score) : '—';
      const idlePct = idle.idleRatePct !== undefined ? idle.idleRatePct.toFixed(1) + '%' : '—';
      return `
<tr class="clickable-row" data-driver-id="${d.driverId}">
  <td>${_esc(d.driverName)}</td>
  <td>${_esc(d.fuelType)}</td>
  <td>${Math.round(d.distanceKm || 0).toLocaleString('es-EC')}</td>
  <td>${fuel.consumption !== undefined ? fuel.consumption.toFixed(2) + ' km/L' : '—'}</td>
  <td>${fuel.deviationPct !== undefined ? (fuel.deviationPct >= 0 ? '+' : '') + fuel.deviationPct.toFixed(1) + '%' : '—'}</td>
  <td>${idlePct}</td>
  <td><span class="score-badge" style="background:${_scoreColor(typeof score === 'number' ? score : 50)}">${score}</span></td>
</tr>`;
    }).join('');

    el.innerHTML = `
<table class="data-table">
  <thead>
    <tr><th>Conductor</th><th>Combust.</th><th>Km</th><th>Consumo</th><th>Desv.</th><th>% Ralentí</th><th>Score</th></tr>
  </thead>
  <tbody>${rows}</tbody>
</table>`;

    el.querySelectorAll('.clickable-row').forEach(row => {
      row.style.cursor = 'pointer';
      row.addEventListener('click', function () {
        DP360.App && DP360.App.openDriverProfile(this.dataset.driverId);
      });
    });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  function _avg(arr) {
    if (!arr.length) return 0;
    return arr.reduce((s, v) => s + v, 0) / arr.length;
  }

  function _kpi(label, value, unit, color) {
    return `<div class="kpi-card">
      <div class="kpi-value" style="color:${color}">${value}</div>
      <div class="kpi-unit">${unit}</div>
      <div class="kpi-label">${label}</div>
    </div>`;
  }

  function _scoreColor(score) {
    if (score >= 90) return '#10b981';
    if (score >= 75) return '#22c55e';
    if (score >= 60) return '#f59e0b';
    if (score >= 40) return '#f97316';
    return '#ef4444';
  }

  function _idleColor(pct) {
    if (pct <= 10) return '#10b981';
    if (pct <= 15) return '#f59e0b';
    return '#ef4444';
  }

  function _esc(str) {
    return (str || '').replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));
  }

  DP360.Views.Fuel = { render };

})(window.DP360 = window.DP360 || {});

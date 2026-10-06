/**
 * Driver Performance 360 — views/safety.js
 * Safety Analysis view.
 * Namespace: DP360.Views.Safety
 * Version: 1.0.0
 */

(function (DP360) {
  'use strict';

  DP360.Views = DP360.Views || {};

  function render(drivers, config) {
    _renderKPIs(drivers);
    _renderComponentsChart(drivers);
    _renderCriticalTable(drivers);
    _renderDistribution(drivers);
  }

  function _renderKPIs(drivers) {
    const el = document.getElementById('safety-kpis');
    if (!el) return;

    const eligible = drivers.filter(d => d.evaluationStatus !== 'insufficient');
    if (!eligible.length) { el.innerHTML = '<p class="no-data">Sin datos.</p>'; return; }

    const avgSafety = _avg(eligible.map(d => d.safetyScore || 0));

    // Event totals
    const totalEvents = {
      speeding:          eligible.reduce((s, d) => s + _evts(d, 'speeding'), 0),
      harshBraking:      eligible.reduce((s, d) => s + _evts(d, 'harshBraking'), 0),
      harshAcceleration: eligible.reduce((s, d) => s + _evts(d, 'harshAcceleration'), 0),
      harshCornering:    eligible.reduce((s, d) => s + _evts(d, 'harshCornering'), 0),
      other:             eligible.reduce((s, d) => s + _evts(d, 'other'), 0)
    };

    const critical = eligible.filter(d => (d.safetyScore || 0) < 40).length;

    el.innerHTML = `
<div class="kpi-grid">
  ${_kpi('Score Seguridad Flota', Math.round(avgSafety), 'pts', _scoreColor(avgSafety))}
  ${_kpi('Excesos Velocidad', totalEvents.speeding, 'eventos', '#ef4444')}
  ${_kpi('Frenados Bruscos', totalEvents.harshBraking, 'eventos', '#f97316')}
  ${_kpi('Aceleraciones', totalEvents.harshAcceleration, 'eventos', '#f59e0b')}
  ${_kpi('Giros Bruscos', totalEvents.harshCornering, 'eventos', '#6366f1')}
  ${_kpi('Conductores Críticos', critical, 'en seguridad', critical > 0 ? '#ef4444' : '#10b981')}
</div>`;
  }

  function _renderComponentsChart(drivers) {
    const eligible = drivers
      .filter(d => d.evaluationStatus !== 'insufficient')
      .sort((a, b) => (a.safetyScore || 0) - (b.safetyScore || 0))
      .slice(0, 15);
    DP360.Charts.renderSafetyComponents('chart-safety-components', eligible);
  }

  function _renderCriticalTable(drivers) {
    const el = document.getElementById('safety-critical-table');
    if (!el) return;

    const eligible = drivers
      .filter(d => d.evaluationStatus !== 'insufficient' && (d.safetyScore || 0) < 60)
      .sort((a, b) => (a.safetyScore || 0) - (b.safetyScore || 0));

    if (!eligible.length) {
      el.innerHTML = '<p class="no-data">Sin conductores con score de seguridad crítico. ✅</p>';
      return;
    }

    const rows = eligible.map(d => {
      const s = d.safety || {};
      return `
<tr class="clickable-row" data-driver-id="${d.driverId}">
  <td>${_esc(d.driverName)}</td>
  <td>${_esc(d.group || '—')}</td>
  <td><span class="score-badge" style="background:${_scoreColor(d.safetyScore || 0)}">${Math.round(d.safetyScore || 0)}</span></td>
  <td>${_evts(d, 'speeding')}</td>
  <td>${_evts(d, 'harshBraking')}</td>
  <td>${_evts(d, 'harshAcceleration')}</td>
  <td>${_evts(d, 'harshCornering')}</td>
  <td>${Math.round(d.distanceKm || 0).toLocaleString('es-EC')}</td>
</tr>`;
    }).join('');

    el.innerHTML = `
<table class="data-table">
  <thead>
    <tr>
      <th>Conductor</th><th>Zona</th><th>Score Seg.</th>
      <th>Vel.</th><th>Frenado</th><th>Aceleración</th><th>Giro</th><th>Km</th>
    </tr>
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

  function _renderDistribution(drivers) {
    DP360.Charts.renderScoreDistribution('chart-safety-distribution',
      drivers.filter(d => d.evaluationStatus !== 'insufficient').map(d => ({ score: d.safetyScore || 0 }))
    );
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  function _evts(d, key) {
    return (d.safety && d.safety[key] && d.safety[key].rawEvents) || 0;
  }

  function _avg(arr) {
    if (!arr.length) return 0;
    return arr.reduce((s, v) => s + v, 0) / arr.length;
  }

  function _kpi(label, value, unit, color) {
    return `<div class="kpi-card">
      <div class="kpi-value" style="color:${color}">${typeof value === 'number' ? value.toLocaleString('es-EC') : value}</div>
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

  function _esc(str) {
    return (str || '').replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));
  }

  DP360.Views.Safety = { render };

})(window.DP360 = window.DP360 || {});

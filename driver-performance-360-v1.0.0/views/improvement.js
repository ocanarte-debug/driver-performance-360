/**
 * Driver Performance 360 — views/improvement.js
 * Score improvement comparison: current period vs previous.
 * Namespace: DP360.Views.Improvement
 * Version: 1.0.0
 */

(function (DP360) {
  'use strict';

  DP360.Views = DP360.Views || {};

  function render(filteredDrivers, allDrivers, config) {
    const prevDrivers = _getPreviousPeriodDrivers(config);
    _renderKPIs(filteredDrivers, prevDrivers);
    _renderComparisonChart(filteredDrivers, prevDrivers);
    _renderTable(filteredDrivers, prevDrivers);
  }

  // ─── Previous Period ──────────────────────────────────────────────────────

  function _getPreviousPeriodDrivers(config) {
    if (!DP360.MockData || !DP360.API.isMockMode()) return [];

    const filterState = DP360.Filters.getState();
    const currFrom = filterState.dateFrom || new Date(Date.now() - 30 * 864e5);
    const currTo   = filterState.dateTo   || new Date();

    const periodLength = currTo - currFrom; // ms
    const prevTo   = new Date(currFrom.getTime());
    const prevFrom = new Date(currFrom.getTime() - periodLength);

    const metrics = DP360.MockData.getMetrics(prevFrom, prevTo);
    if (!metrics.length) return [];
    return DP360.ScoreEngine.evaluateAll(metrics, config);
  }

  // ─── KPIs ─────────────────────────────────────────────────────────────────

  function _renderKPIs(curr, prev) {
    const el = document.getElementById('improvement-kpis');
    if (!el) return;

    const eligible = curr.filter(d => d.evaluationStatus !== 'insufficient');
    if (!eligible.length) { el.innerHTML = '<p class="no-data">Sin datos.</p>'; return; }

    const avgCurr = _avg(eligible.map(d => d.score));
    const avgPrev = prev.length
      ? _avg(prev.filter(d => d.evaluationStatus !== 'insufficient').map(d => d.score))
      : null;

    const delta = avgPrev !== null ? avgCurr - avgPrev : null;
    const deltaStr = delta !== null
      ? `${delta >= 0 ? '+' : ''}${delta.toFixed(1)} pts`
      : '—';
    const deltaColor = delta === null ? '#6b7280' : delta >= 0 ? '#10b981' : '#ef4444';

    const improved  = prev.length ? _countImproved(curr, prev, true)  : '—';
    const worsened  = prev.length ? _countImproved(curr, prev, false) : '—';

    el.innerHTML = `
<div class="kpi-grid">
  ${_kpi('Score Actual',     Math.round(avgCurr), 'pts',  _scoreColor(avgCurr))}
  ${avgPrev !== null ? _kpi('Score Anterior', Math.round(avgPrev), 'pts', _scoreColor(avgPrev)) : ''}
  ${_kpi('Variación', deltaStr, 'vs período anterior', deltaColor)}
  ${typeof improved === 'number' ? _kpi('Mejoraron', improved, 'conductores', '#10b981') : ''}
  ${typeof worsened === 'number' ? _kpi('Empeoraron', worsened, 'conductores', '#ef4444') : ''}
</div>`;
  }

  function _countImproved(curr, prev, direction) {
    const prevMap = {};
    prev.forEach(d => { prevMap[d.driverId] = d; });
    return curr.filter(d => {
      const p = prevMap[d.driverId];
      if (!p) return false;
      return direction
        ? d.score > p.score
        : d.score < p.score;
    }).length;
  }

  // ─── Chart ────────────────────────────────────────────────────────────────

  function _renderComparisonChart(curr, prev) {
    const prevMap = {};
    prev.forEach(d => { prevMap[d.driverId] = d; });

    const eligible = curr
      .filter(d => prevMap[d.driverId] && d.evaluationStatus !== 'insufficient')
      .sort((a, b) => {
        const deltaA = a.score - (prevMap[a.driverId] ? prevMap[a.driverId].score : a.score);
        const deltaB = b.score - (prevMap[b.driverId] ? prevMap[b.driverId].score : b.score);
        return deltaA - deltaB; // worst improvement first
      })
      .slice(0, 20);

    if (!eligible.length) return;

    const comparison = eligible.map(d => ({
      driverName: d.driverName,
      prevScore:  prevMap[d.driverId] ? prevMap[d.driverId].score : 0,
      currScore:  d.score
    }));

    DP360.Charts.renderImprovementComparison('chart-improvement', comparison);
  }

  // ─── Table ────────────────────────────────────────────────────────────────

  function _renderTable(curr, prev) {
    const el = document.getElementById('improvement-table');
    if (!el) return;

    const prevMap = {};
    prev.forEach(d => { prevMap[d.driverId] = d; });

    const rows = curr
      .filter(d => d.evaluationStatus !== 'insufficient')
      .sort((a, b) => {
        const da = a.score - (prevMap[a.driverId] ? prevMap[a.driverId].score : a.score);
        const db = b.score - (prevMap[b.driverId] ? prevMap[b.driverId].score : b.score);
        return da - db;
      })
      .map(d => {
        const p = prevMap[d.driverId];
        const prevScore = p ? Math.round(p.score) : null;
        const delta     = prevScore !== null ? d.score - prevScore : null;
        const arrow     = delta === null ? '—' : delta >= 0
          ? `<span style="color:#10b981">▲ +${delta.toFixed(1)}</span>`
          : `<span style="color:#ef4444">▼ ${delta.toFixed(1)}</span>`;

        return `
<tr class="clickable-row" data-driver-id="${d.driverId}">
  <td>${_esc(d.driverName)}</td>
  <td>${_esc(d.group || '—')}</td>
  <td>${prevScore !== null ? prevScore : '—'}</td>
  <td><span class="score-badge" style="background:${_scoreColor(d.score)}">${Math.round(d.score)}</span></td>
  <td>${arrow}</td>
  <td><span class="status-chip" style="color:${d.statusColor}">${d.statusLabel}</span></td>
</tr>`;
      }).join('');

    el.innerHTML = rows.length
      ? `<table class="data-table">
           <thead>
             <tr><th>Conductor</th><th>Zona</th><th>Anterior</th><th>Actual</th><th>Variación</th><th>Estado</th></tr>
           </thead>
           <tbody>${rows}</tbody>
         </table>`
      : '<p class="no-data">No hay datos comparativos disponibles.</p>';

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

  function _esc(str) {
    return (str || '').replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));
  }

  DP360.Views.Improvement = { render };

})(window.DP360 = window.DP360 || {});

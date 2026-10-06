/**
 * Driver Performance 360 — views/driver.js
 * Driver 360 Profile: radar chart, score breakdown, weekly trend, details.
 * Namespace: DP360.Views.Driver
 * Version: 1.0.0
 */

(function (DP360) {
  'use strict';

  DP360.Views = DP360.Views || {};

  function render(driver, allDrivers, config) {
    const container = document.getElementById('view-driver');
    if (!container) return;

    if (!driver) {
      container.innerHTML = '<p class="no-data">Selecciona un conductor desde el Ranking o la vista de Flota.</p>';
      return;
    }

    _renderSelector(driver, allDrivers);
    _renderHeader(driver);
    _renderScoreSummary(driver);
    _renderRadar(driver);
    _renderBreakdown(driver);
    _renderSafetyDetails(driver);
    _renderEfficiencyDetails(driver);
    _renderWeeklyTrend(driver);
    _renderRecommendations(driver);
  }

  // ─── Driver Selector ──────────────────────────────────────────────────────

  function _renderSelector(current, allDrivers) {
    const el = document.getElementById('driver-selector');
    if (!el || !allDrivers) return;

    const sorted = allDrivers.slice().sort((a, b) => a.driverName.localeCompare(b.driverName));
    el.innerHTML = sorted.map(d =>
      `<option value="${d.driverId}" ${d.driverId === current.driverId ? 'selected' : ''}>${_esc(d.driverName)}</option>`
    ).join('');

    el.onchange = function () {
      DP360.App && DP360.App.openDriverProfile(this.value);
    };
  }

  // ─── Header ───────────────────────────────────────────────────────────────

  function _renderHeader(d) {
    const el = document.getElementById('driver-header');
    if (!el) return;

    const statusColor = d.statusColor || '#9ca3af';
    const evalBadge = {
      full:         '<span class="eval-badge eval-full">Evaluación completa</span>',
      provisional:  '<span class="eval-badge eval-prov">Evaluación parcial</span>',
      insufficient: '<span class="eval-badge eval-insuf">Datos insuficientes</span>'
    }[d.evaluationStatus] || '';

    el.innerHTML = `
<div class="driver-header-inner">
  <div class="driver-avatar">${_initials(d.driverName)}</div>
  <div class="driver-header-info">
    <h2 class="driver-name">${_esc(d.driverName)}</h2>
    <div class="driver-meta">
      <span>${_esc(d.vehicleType)}</span>
      <span>·</span>
      <span>${_esc(d.fuelType)}</span>
      <span>·</span>
      <span>${_esc(d.group || '—')}</span>
      <span>·</span>
      <span>${Math.round(d.distanceKm || 0).toLocaleString('es-EC')} km</span>
    </div>
    <div class="driver-badges">
      <span class="status-badge" style="background:${statusColor};color:#fff">${d.statusLabel}</span>
      ${evalBadge}
    </div>
  </div>
  <div class="driver-score-big">
    <div class="score-circle" style="border-color:${statusColor}">
      <span class="score-number" style="color:${statusColor}">${Math.round(d.score)}</span>
      <span class="score-label">/ 100</span>
    </div>
  </div>
</div>`;
  }

  // ─── Score Summary Cards ──────────────────────────────────────────────────

  function _renderScoreSummary(d) {
    const el = document.getElementById('driver-score-summary');
    if (!el) return;

    el.innerHTML = `
<div class="score-summary-grid">
  ${_scoreCard('Seguridad', Math.round(d.safetyScore || 0), '60% del total')}
  ${_scoreCard('Eficiencia', Math.round(d.efficiencyScore || 0), '40% del total')}
  ${_scoreCard('Total', Math.round(d.score), 'Puntaje final')}
</div>`;
  }

  function _scoreCard(label, score, sub) {
    const color = _scoreColor(score);
    return `
<div class="score-summary-card">
  <div class="score-summary-value" style="color:${color}">${score}</div>
  <div class="score-summary-label">${label}</div>
  <div class="score-summary-sub">${sub}</div>
</div>`;
  }

  // ─── Radar Chart ─────────────────────────────────────────────────────────

  function _renderRadar(d) {
    DP360.Charts.renderDriverRadar('chart-driver-radar', d);
  }

  // ─── Score Breakdown ──────────────────────────────────────────────────────

  function _renderBreakdown(d) {
    const el = document.getElementById('driver-breakdown');
    if (!el) return;

    const bd = d.breakdown;
    if (!bd || !bd.items) {
      el.innerHTML = '<p class="no-data">Desglose no disponible.</p>';
      return;
    }

    const rows = bd.items.map(item => {
      const impactColor = item.impact < 0 ? '#ef4444' : '#10b981';
      const impactSign  = item.impact < 0 ? '' : '+';
      return `
<tr>
  <td>${_esc(item.label)}</td>
  <td class="score-sub">${item.per100km !== undefined ? Number(item.per100km).toFixed(2) + ' /100km' : '—'}</td>
  <td class="score-sub">${Math.round(item.score || 0)} pts</td>
  <td style="color:${impactColor};font-weight:600">${impactSign}${Number(item.impact).toFixed(1)} pts</td>
</tr>`;
    }).join('');

    el.innerHTML = `
<div class="breakdown-header">
  <span>Puntaje base: <strong>100</strong></span>
  <span>→</span>
  <span>Puntaje final: <strong style="color:${_scoreColor(d.score)}">${Math.round(d.score)}</strong></span>
</div>
<table class="data-table breakdown-table">
  <thead>
    <tr><th>Componente</th><th>Métrica</th><th>Score componente</th><th>Impacto</th></tr>
  </thead>
  <tbody>${rows}</tbody>
</table>`;
  }

  // ─── Safety Details ───────────────────────────────────────────────────────

  function _renderSafetyDetails(d) {
    const el = document.getElementById('driver-safety-detail');
    if (!el) return;

    const s = d.safety || {};
    const components = [
      { key: 'speeding',          label: 'Exceso de velocidad', weight: '25%' },
      { key: 'harshBraking',      label: 'Frenado brusco',      weight: '25%' },
      { key: 'harshAcceleration', label: 'Aceleración brusca',  weight: '20%' },
      { key: 'harshCornering',    label: 'Giro brusco',          weight: '15%' },
      { key: 'other',             label: 'Otros eventos',        weight: '15%' }
    ];

    const rows = components.map(c => {
      const comp = s[c.key] || {};
      const score = comp.score !== undefined ? Math.round(comp.score) : '—';
      const per100 = comp.per100km !== undefined ? Number(comp.per100km).toFixed(2) : '—';
      const events = comp.rawEvents !== undefined ? comp.rawEvents : '—';
      const color = typeof score === 'number' ? _scoreColor(score) : '#9ca3af';
      return `
<tr>
  <td>${c.label}</td>
  <td class="score-sub">${c.weight}</td>
  <td>${events}</td>
  <td class="score-sub">${per100}</td>
  <td><span class="score-badge" style="background:${color}">${score}</span></td>
</tr>`;
    }).join('');

    el.innerHTML = `
<table class="data-table">
  <thead>
    <tr><th>Componente</th><th>Peso</th><th>Eventos</th><th>Por 100km</th><th>Score</th></tr>
  </thead>
  <tbody>${rows}</tbody>
</table>`;
  }

  // ─── Efficiency Details ───────────────────────────────────────────────────

  function _renderEfficiencyDetails(d) {
    const el = document.getElementById('driver-efficiency-detail');
    if (!el) return;

    const e = d.efficiency || {};

    // Idling
    const idle = e.idling || {};
    const idlePct   = idle.idleRatePct !== undefined ? idle.idleRatePct.toFixed(1) + '%' : '—';
    const idleScore = idle.score !== undefined ? Math.round(idle.score) : '—';

    // Fuel
    const fuel = e.fuel || {};
    const fuelLabel = d.fuelType === 'GNV' ? 'km/m³' : 'km/L';
    const fuelVal   = fuel.consumption !== undefined ? fuel.consumption.toFixed(2) + ' ' + fuelLabel : '—';
    const fuelDev   = fuel.deviationPct !== undefined ? (fuel.deviationPct >= 0 ? '+' : '') + fuel.deviationPct.toFixed(1) + '% vs benchmark' : '—';
    const fuelScore = fuel.score !== undefined ? Math.round(fuel.score) : '—';

    // Utilization
    const util = e.utilization || {};
    const utilPct   = util.utilizationPct !== undefined ? util.utilizationPct.toFixed(1) + '%' : '—';
    const utilScore = util.score !== undefined ? Math.round(util.score) : '—';

    el.innerHTML = `
<div class="efficiency-detail-grid">
  <div class="eff-card">
    <div class="eff-card-title">Ralentí</div>
    <div class="eff-card-value">${idlePct}</div>
    <div class="eff-card-sub">de tiempo motor encendido</div>
    <div class="eff-card-score" style="color:${_scoreColor(typeof idleScore === 'number' ? idleScore : 50)}">Score: ${idleScore}</div>
    <div class="eff-card-weight">Peso: 40%</div>
  </div>
  <div class="eff-card">
    <div class="eff-card-title">Combustible</div>
    <div class="eff-card-value">${fuelVal}</div>
    <div class="eff-card-sub">${fuelDev}</div>
    <div class="eff-card-score" style="color:${_scoreColor(typeof fuelScore === 'number' ? fuelScore : 50)}">Score: ${fuelScore}</div>
    <div class="eff-card-weight">Peso: 45%</div>
  </div>
  <div class="eff-card">
    <div class="eff-card-title">Utilización</div>
    <div class="eff-card-value">${utilPct}</div>
    <div class="eff-card-sub">del tiempo disponible</div>
    <div class="eff-card-score" style="color:${_scoreColor(typeof utilScore === 'number' ? utilScore : 50)}">Score: ${utilScore}</div>
    <div class="eff-card-weight">Peso: 15%</div>
  </div>
</div>`;
  }

  // ─── Weekly Trend ────────────────────────────────────────────────────────

  function _renderWeeklyTrend(d) {
    const trend = DP360.MockData ? DP360.MockData.getDriverWeeklyTrend(d.driverId) : [];
    if (!trend || !trend.length) {
      const secEl = document.getElementById('driver-trend-section');
      if (secEl) secEl.style.display = 'none';
      return;
    }
    const config = DP360.App ? DP360.App.getState().scoringConfig : null;

    const weeks  = trend.map(t => t.weekLabel);
    const scores = trend.map(t => {
      const ev = DP360.ScoreEngine.evaluateAll([t.metrics], config);
      return ev[0] ? Math.round(ev[0].score) : null;
    }).filter(s => s !== null);

    DP360.Charts.renderScoreTrend('chart-driver-trend', weeks, scores);
  }

  // ─── Recommendations ─────────────────────────────────────────────────────

  function _renderRecommendations(d) {
    const el = document.getElementById('driver-recommendations');
    if (!el) return;

    const recs = _generateRecommendations(d);
    if (!recs.length) {
      el.innerHTML = '<p class="no-data">Conductor con buen desempeño general. Sin recomendaciones específicas.</p>';
      return;
    }

    el.innerHTML = recs.map(r => `
<div class="rec-item rec-${r.priority}">
  <div class="rec-icon">${r.icon}</div>
  <div class="rec-body">
    <div class="rec-title">${r.title}</div>
    <div class="rec-text">${r.text}</div>
  </div>
  <div class="rec-priority-badge priority-${r.priority}">${r.priorityLabel}</div>
</div>`).join('');
  }

  function _generateRecommendations(d) {
    const recs = [];
    const s = d.safety || {};
    const e = d.efficiency || {};

    if ((s.speeding || {}).score < 70) {
      recs.push({
        icon: '🚨', priority: 'critical', priorityLabel: 'Alta',
        title: 'Reducir excesos de velocidad',
        text: `${(s.speeding.rawEvents || 0)} eventos registrados (${(s.speeding.per100km || 0).toFixed(1)} /100km). Revisar zonas de riesgo y reforzar capacitación sobre límites.`
      });
    }
    if ((s.harshBraking || {}).score < 70) {
      recs.push({
        icon: '⚠️', priority: 'high', priorityLabel: 'Media-Alta',
        title: 'Mejorar técnica de frenado',
        text: `${(s.harshBraking.rawEvents || 0)} eventos de frenado brusco. Sugerir mayor distancia de seguimiento y anticipación al tráfico.`
      });
    }
    if ((s.harshAcceleration || {}).score < 70) {
      recs.push({
        icon: '⚡', priority: 'medium', priorityLabel: 'Media',
        title: 'Suavizar aceleración',
        text: `${(s.harshAcceleration.rawEvents || 0)} eventos. La aceleración gradual reduce el consumo de combustible y el desgaste mecánico.`
      });
    }
    if ((e.idling || {}).idleRatePct > 15) {
      recs.push({
        icon: '🕐', priority: 'medium', priorityLabel: 'Media',
        title: 'Reducir tiempo de ralentí',
        text: `${((e.idling || {}).idleRatePct || 0).toFixed(1)}% del tiempo motor encendido sin movimiento. Establecer límite de 5 minutos antes de apagar el motor.`
      });
    }
    if ((e.fuel || {}).score < 60) {
      recs.push({
        icon: '⛽', priority: 'medium', priorityLabel: 'Media',
        title: 'Optimizar consumo de combustible',
        text: `Consumo ${Math.abs(((e.fuel || {}).deviationPct || 0)).toFixed(1)}% por encima del benchmark del tipo de vehículo. Verificar presión de neumáticos y velocidad crucero.`
      });
    }

    return recs.slice(0, 5); // Max 5 recommendations
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  function _initials(name) {
    return (name || 'NN').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  function _scoreColor(score) {
    if (score >= 90) return '#10b981';
    if (score >= 75) return '#22c55e';
    if (score >= 60) return '#f59e0b';
    if (score >= 40) return '#f97316';
    return '#ef4444';
  }

  function _esc(str) {
    return (str || '').replace(/[<>&"']/g, c => ({
      '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  DP360.Views.Driver = { render };

})(window.DP360 = window.DP360 || {});

/**
 * Driver Performance 360 — views/coaching.js
 * Coaching Center: risk identification, recommendations, plan creation.
 * Namespace: DP360.Views.Coaching
 * Version: 1.0.0
 */

(function (DP360) {
  'use strict';

  DP360.Views = DP360.Views || {};

  function render(drivers, config) {
    _renderRiskTable(drivers);
    _renderPlansList();
    _bindPlanModal();
  }

  // ─── Risk Driver Table ────────────────────────────────────────────────────

  function _renderRiskTable(drivers) {
    const el = document.getElementById('coaching-risk-table');
    if (!el) return;

    const atRisk = drivers
      .filter(d => d.evaluationStatus !== 'insufficient' && d.score < 60)
      .sort((a, b) => a.score - b.score);

    if (!atRisk.length) {
      el.innerHTML = '<p class="no-data">No hay conductores de alto riesgo en el período seleccionado. ✅</p>';
      return;
    }

    const rows = atRisk.map(d => {
      const topWeakness = _topWeakness(d);
      const hasPlan     = DP360.Storage ? DP360.Storage.getCoachingPlan(d.driverId) !== null : false;
      return `
<tr>
  <td>${_esc(d.driverName)}</td>
  <td>${_esc(d.group || '—')}</td>
  <td><span class="score-badge" style="background:${d.statusColor}">${Math.round(d.score)}</span></td>
  <td>${Math.round(d.safetyScore || 0)}</td>
  <td>${Math.round(d.efficiencyScore || 0)}</td>
  <td><span class="weakness-chip">${topWeakness}</span></td>
  <td>
    <button class="btn btn-sm btn-primary btn-create-plan" data-driver-id="${d.driverId}" data-driver-name="${_esc(d.driverName)}">
      ${hasPlan ? '📋 Ver plan' : '➕ Crear plan'}
    </button>
    <button class="btn btn-sm btn-ghost btn-view-driver" data-driver-id="${d.driverId}">
      👤 Perfil
    </button>
  </td>
</tr>`;
    }).join('');

    el.innerHTML = `
<div class="risk-count-bar">
  <strong>${atRisk.length}</strong> conductores requieren atención de coaching
</div>
<table class="data-table">
  <thead>
    <tr>
      <th>Conductor</th><th>Zona</th><th>Puntaje</th><th>Seguridad</th>
      <th>Eficiencia</th><th>Principal debilidad</th><th>Acciones</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>`;

    el.querySelectorAll('.btn-create-plan').forEach(btn => {
      btn.addEventListener('click', function () {
        _openPlanModal(this.dataset.driverId, this.dataset.driverName,
          atRisk.find(d => d.driverId === this.dataset.driverId));
      });
    });

    el.querySelectorAll('.btn-view-driver').forEach(btn => {
      btn.addEventListener('click', function () {
        DP360.App && DP360.App.openDriverProfile(this.dataset.driverId);
      });
    });
  }

  // ─── Coaching Plans List ──────────────────────────────────────────────────

  function _renderPlansList() {
    const el = document.getElementById('coaching-plans-list');
    if (!el) return;
    if (!DP360.Storage) { el.innerHTML = ''; return; }

    const plans = DP360.Storage.getAllCoachingPlans();
    if (!plans.length) {
      el.innerHTML = '<p class="no-data">No hay planes de coaching creados aún.</p>';
      return;
    }

    const rows = plans.map(plan => `
<tr>
  <td>${_esc(plan.driverName || plan.driverId)}</td>
  <td>${_esc(plan.focus || '—')}</td>
  <td>${_esc(plan.coach || '—')}</td>
  <td>${plan.createdAt ? new Date(plan.createdAt).toLocaleDateString('es-EC') : '—'}</td>
  <td>${plan.targetDate ? new Date(plan.targetDate).toLocaleDateString('es-EC') : '—'}</td>
  <td><span class="plan-status status-${(plan.status||'pending').toLowerCase()}">${_planStatusLabel(plan.status)}</span></td>
  <td>
    <button class="btn btn-sm btn-ghost btn-edit-plan" data-driver-id="${plan.driverId}">✏️</button>
    <button class="btn btn-sm btn-ghost btn-delete-plan" data-driver-id="${plan.driverId}">🗑️</button>
  </td>
</tr>`).join('');

    el.innerHTML = `
<table class="data-table">
  <thead>
    <tr><th>Conductor</th><th>Enfoque</th><th>Coach</th><th>Creado</th><th>Meta</th><th>Estado</th><th></th></tr>
  </thead>
  <tbody>${rows}</tbody>
</table>`;

    el.querySelectorAll('.btn-delete-plan').forEach(btn => {
      btn.addEventListener('click', function () {
        if (confirm('¿Eliminar plan de coaching?')) {
          DP360.Storage.deleteCoachingPlan(this.dataset.driverId);
          _renderPlansList();
        }
      });
    });

    el.querySelectorAll('.btn-edit-plan').forEach(btn => {
      btn.addEventListener('click', function () {
        const plan = DP360.Storage.getCoachingPlan(this.dataset.driverId);
        if (plan) _openPlanModal(plan.driverId, plan.driverName, null, plan);
      });
    });
  }

  // ─── Plan Modal ───────────────────────────────────────────────────────────

  function _bindPlanModal() {
    const closeBtn = document.getElementById('btn-close-plan-modal');
    if (closeBtn) closeBtn.onclick = _closePlanModal;

    const cancelBtn = document.getElementById('btn-cancel-plan');
    if (cancelBtn) cancelBtn.onclick = _closePlanModal;

    const saveBtn = document.getElementById('btn-save-plan');
    if (saveBtn) saveBtn.onclick = _savePlan;
  }

  function _openPlanModal(driverId, driverName, driver, existingPlan) {
    const modal = document.getElementById('plan-modal');
    if (!modal) return;

    // Fill driver info
    const nameEl = document.getElementById('plan-driver-name');
    if (nameEl) nameEl.textContent = driverName || driverId;

    // Fill suggested actions from driver weaknesses
    if (driver) {
      const suggestions = _generateSuggestions(driver);
      const notesEl = document.getElementById('plan-notes');
      if (notesEl && !existingPlan) notesEl.value = suggestions.join('\n');
    }

    // Fill existing plan data
    if (existingPlan) {
      _setVal('plan-focus',   existingPlan.focus);
      _setVal('plan-coach',   existingPlan.coach);
      _setVal('plan-target',  existingPlan.targetDate ? existingPlan.targetDate.slice(0, 10) : '');
      _setVal('plan-status',  existingPlan.status || 'pending');
      _setVal('plan-notes',   existingPlan.notes);
    } else {
      _setVal('plan-focus',   '');
      _setVal('plan-coach',   '');
      _setVal('plan-target',  '');
      _setVal('plan-status',  'pending');
    }

    modal.dataset.driverId   = driverId;
    modal.dataset.driverName = driverName;
    modal.style.display = 'flex';
  }

  function _closePlanModal() {
    const modal = document.getElementById('plan-modal');
    if (modal) modal.style.display = 'none';
  }

  function _savePlan() {
    const modal = document.getElementById('plan-modal');
    if (!modal || !DP360.Storage) return;

    const driverId   = modal.dataset.driverId;
    const driverName = modal.dataset.driverName;

    const plan = {
      driverId,
      driverName,
      focus:      _getVal('plan-focus'),
      coach:      _getVal('plan-coach'),
      targetDate: _getVal('plan-target') || null,
      status:     _getVal('plan-status') || 'pending',
      notes:      _getVal('plan-notes'),
      updatedAt:  new Date().toISOString()
    };

    const existing = DP360.Storage.getCoachingPlan(driverId);
    if (!existing) plan.createdAt = plan.updatedAt;

    DP360.Storage.setCoachingPlan(driverId, plan);
    _closePlanModal();
    _renderPlansList();
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  function _topWeakness(d) {
    const components = [
      { key: 'speeding',          label: 'Exceso velocidad', score: (d.safety || {}).speeding ? d.safety.speeding.score : 100 },
      { key: 'harshBraking',      label: 'Frenado brusco',  score: (d.safety || {}).harshBraking ? d.safety.harshBraking.score : 100 },
      { key: 'harshAcceleration', label: 'Aceleración',     score: (d.safety || {}).harshAcceleration ? d.safety.harshAcceleration.score : 100 },
      { key: 'idling',            label: 'Ralentí',         score: (d.efficiency || {}).idling ? d.efficiency.idling.score : 100 },
      { key: 'fuel',              label: 'Combustible',     score: (d.efficiency || {}).fuel ? d.efficiency.fuel.score : 100 }
    ];
    const weakest = components.reduce((min, c) => c.score < min.score ? c : min, { score: 100, label: '—' });
    return weakest.label;
  }

  function _generateSuggestions(d) {
    const suggestions = [];
    const s = d.safety    || {};
    const e = d.efficiency || {};

    if ((s.speeding     || {}).score < 70) suggestions.push('• Capacitación sobre límites de velocidad por zona');
    if ((s.harshBraking || {}).score < 70) suggestions.push('• Entrenamiento en distancia de frenado y anticipación');
    if ((s.harshAcceleration || {}).score < 70) suggestions.push('• Técnica de aceleración progresiva');
    if ((e.idling  || {}).idleRatePct > 15) suggestions.push('• Protocolo de apagado de motor: máximo 5 min de ralentí');
    if ((e.fuel    || {}).score < 60) suggestions.push('• Revisión de presión de neumáticos y velocidad crucero');

    return suggestions.length ? suggestions : ['• Mantener buen desempeño. Sesión de reconocimiento y seguimiento.'];
  }

  function _planStatusLabel(status) {
    const labels = {
      pending:    'Pendiente',
      active:     'Activo',
      completed:  'Completado',
      cancelled:  'Cancelado'
    };
    return labels[status] || status || 'Pendiente';
  }

  function _setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val || '';
  }

  function _getVal(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function _esc(str) {
    return (str || '').replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));
  }

  DP360.Views.Coaching = { render };

})(window.DP360 = window.DP360 || {});

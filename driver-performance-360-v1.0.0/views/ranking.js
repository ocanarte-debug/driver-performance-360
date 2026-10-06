/**
 * Driver Performance 360 — views/ranking.js
 * Full sortable/filterable driver ranking table with CSV export.
 * Namespace: DP360.Views.Ranking
 * Version: 1.0.0
 */

(function (DP360) {
  'use strict';

  DP360.Views = DP360.Views || {};

  let _currentDrivers = [];
  let _sortField = 'score';
  let _sortDir   = 'asc';

  function render(drivers, config) {
    _currentDrivers = drivers || [];
    _sortField = DP360.Filters.getState().sortField || 'score';
    _sortDir   = DP360.Filters.getState().sortDir   || 'asc';
    _renderTable();
    _bindExport();
  }

  // ─── Table ────────────────────────────────────────────────────────────────

  function _renderTable() {
    const container = document.getElementById('ranking-table-wrap');
    if (!container) return;

    if (!_currentDrivers.length) {
      container.innerHTML = '<p class="no-data">Sin conductores para mostrar.</p>';
      return;
    }

    const sorted = _sortDrivers(_currentDrivers, _sortField, _sortDir);

    const COLS = [
      { key: 'rank',          label: '#',             sortable: false },
      { key: 'driverName',    label: 'Conductor',     sortable: true  },
      { key: 'group',         label: 'Zona',          sortable: true  },
      { key: 'vehicleType',   label: 'Tipo',          sortable: true  },
      { key: 'fuelType',      label: 'Combustible',   sortable: true  },
      { key: 'distanceKm',    label: 'Km',            sortable: true  },
      { key: 'score',         label: 'Puntaje',       sortable: true  },
      { key: 'safetyScore',   label: 'Seguridad',     sortable: true  },
      { key: 'efficiencyScore',label: 'Eficiencia',   sortable: true  },
      { key: 'statusLabel',   label: 'Estado',        sortable: true  },
      { key: 'evaluationStatus', label: 'Cobertura',  sortable: true  },
      { key: 'actions',       label: '',              sortable: false }
    ];

    const headerRow = COLS.map(c => {
      if (!c.sortable) return `<th>${c.label}</th>`;
      const isActive = _sortField === c.key;
      const arrow = isActive ? (_sortDir === 'asc' ? '▲' : '▼') : '↕';
      return `<th class="sortable-th ${isActive ? 'sorted' : ''}" data-sort="${c.key}">
        ${c.label} <span class="sort-arrow">${arrow}</span>
      </th>`;
    }).join('');

    const bodyRows = sorted.map((d, i) => {
      const statusColor = d.statusColor || '#9ca3af';
      const evalBadge   = _evalBadge(d.evaluationStatus);
      return `<tr class="data-row" data-driver-id="${d.driverId}">
        <td class="rank-cell">${i + 1}</td>
        <td class="driver-name-cell">${_esc(d.driverName)}</td>
        <td>${_esc(d.group || '—')}</td>
        <td>${_esc(d.vehicleType)}</td>
        <td>${_esc(d.fuelType)}</td>
        <td>${Math.round(d.distanceKm || 0).toLocaleString('es-EC')}</td>
        <td><span class="score-badge" style="background:${statusColor}">${Math.round(d.score)}</span></td>
        <td class="score-sub">${Math.round(d.safetyScore || 0)}</td>
        <td class="score-sub">${Math.round(d.efficiencyScore || 0)}</td>
        <td><span class="status-chip" style="color:${statusColor}">${_esc(d.statusLabel)}</span></td>
        <td>${evalBadge}</td>
        <td>
          <button class="btn-icon btn-view-profile" data-driver-id="${d.driverId}" title="Ver perfil 360">
            👤
          </button>
        </td>
      </tr>`;
    }).join('');

    container.innerHTML = `
<table class="data-table ranking-table" id="ranking-table">
  <thead><tr>${headerRow}</tr></thead>
  <tbody>${bodyRows}</tbody>
</table>`;

    // Bind sort headers
    container.querySelectorAll('.sortable-th').forEach(th => {
      th.addEventListener('click', function () {
        const field = this.dataset.sort;
        if (_sortField === field) {
          _sortDir = _sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          _sortField = field;
          _sortDir   = field === 'score' ? 'asc' : 'asc';
        }
        DP360.Filters.setSort(_sortField, _sortDir);
        _renderTable();
      });
    });

    // Bind profile buttons
    container.querySelectorAll('.btn-view-profile').forEach(btn => {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        DP360.App && DP360.App.openDriverProfile(this.dataset.driverId);
      });
    });

    // Row click → profile
    container.querySelectorAll('.data-row').forEach(row => {
      row.style.cursor = 'pointer';
      row.addEventListener('click', function () {
        DP360.App && DP360.App.openDriverProfile(this.dataset.driverId);
      });
    });

    // Update count
    const countEl = document.getElementById('ranking-count');
    if (countEl) countEl.textContent = `${sorted.length} conductores`;
  }

  // ─── Sort ─────────────────────────────────────────────────────────────────

  function _sortDrivers(drivers, field, dir) {
    return drivers.slice().sort((a, b) => {
      let va = _get(a, field);
      let vb = _get(b, field);
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return dir === 'asc' ? -1 : 1;
      if (va > vb) return dir === 'asc' ?  1 : -1;
      return 0;
    });
  }

  function _get(obj, key) {
    return obj[key] !== undefined ? obj[key] : '';
  }

  // ─── CSV Export ───────────────────────────────────────────────────────────

  function _bindExport() {
    const btn = document.getElementById('btn-export-ranking');
    if (!btn) return;
    btn.onclick = function () { _exportCSV(); };
  }

  function _exportCSV() {
    const sorted = _sortDrivers(_currentDrivers, _sortField, _sortDir);
    const headers = [
      'Posición','Conductor','Zona','Tipo Vehículo','Combustible',
      'Km Recorridos','Puntaje Total','Puntaje Seguridad','Puntaje Eficiencia',
      'Estado','Cobertura',
      'Exceso Vel /100km','Frenado Brusco /100km','Aceleración /100km','Giro /100km',
      '% Ralentí','Combustible (consumo)'
    ];

    const rows = sorted.map((d, i) => {
      const s = d.safety    || {};
      const e = d.efficiency || {};
      return [
        i + 1,
        d.driverName || '',
        d.group || '',
        d.vehicleType || '',
        d.fuelType || '',
        Math.round(d.distanceKm || 0),
        Math.round(d.score),
        Math.round(d.safetyScore || 0),
        Math.round(d.efficiencyScore || 0),
        d.statusLabel || '',
        d.evaluationStatus || '',
        _safeGet(s, 'speeding.per100km'),
        _safeGet(s, 'harshBraking.per100km'),
        _safeGet(s, 'harshAcceleration.per100km'),
        _safeGet(s, 'harshCornering.per100km'),
        _safeGet(e, 'idling.idleRatePct'),
        _safeGet(e, 'fuel.consumption')
      ].map(_csvCell).join(',');
    });

    const csv = [headers.join(','), ...rows].join('\r\n');
    const BOM = '﻿'; // UTF-8 BOM for Excel
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `DriverPerformance360_Ranking_${_dateStamp()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  function _evalBadge(status) {
    const badges = {
      full:         '<span class="eval-badge eval-full">Completo</span>',
      provisional:  '<span class="eval-badge eval-prov">Parcial</span>',
      insufficient: '<span class="eval-badge eval-insuf">Insuf.</span>'
    };
    return badges[status] || badges.insufficient;
  }

  function _safeGet(obj, path) {
    const val = path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : null), obj);
    return val !== null && val !== undefined ? Number(val).toFixed(2) : '—';
  }

  function _csvCell(v) {
    const str = String(v === null || v === undefined ? '' : v);
    return str.includes(',') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"` : str;
  }

  function _dateStamp() {
    return new Date().toISOString().slice(0, 10).replace(/-/g, '');
  }

  function _esc(str) {
    return (str || '').replace(/[<>&"']/g, c => ({
      '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  DP360.Views.Ranking = { render };

})(window.DP360 = window.DP360 || {});

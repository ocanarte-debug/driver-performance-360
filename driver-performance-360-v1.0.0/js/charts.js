/**
 * Driver Performance 360 — charts.js
 * Chart.js wrappers for all Add-In visualizations.
 * Namespace: DP360.Charts
 * Requires: Chart.js loaded globally (cdn)
 * Version: 1.0.0
 */

(function (DP360) {
  'use strict';

  // Chart instances registry — keep references to destroy before re-render
  const _instances = {};

  // ─── Color Palette ────────────────────────────────────────────────────────

  const COLORS = {
    excellent:  '#10b981',
    good:       '#22c55e',
    acceptable: '#f59e0b',
    improvable: '#f97316',
    critical:   '#ef4444',
    blue:       '#3b82f6',
    indigo:     '#6366f1',
    purple:     '#8b5cf6',
    gray:       '#9ca3af',
    lightGray:  '#e5e7eb',
    white:      '#ffffff',
    // Transparent variants
    blueAlpha:  'rgba(59,130,246,0.15)',
    greenAlpha: 'rgba(16,185,129,0.15)',
    redAlpha:   'rgba(239,68,68,0.15)'
  };

  const STATUS_COLORS = {
    Excelente:  COLORS.excellent,
    Bueno:      COLORS.good,
    Aceptable:  COLORS.acceptable,
    Improvable: COLORS.improvable,
    Crítico:    COLORS.critical
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function _destroy(id) {
    if (_instances[id]) {
      _instances[id].destroy();
      delete _instances[id];
    }
  }

  function _getCtx(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) { console.warn('[DP360.Charts] canvas not found:', canvasId); return null; }
    _destroy(canvasId);
    return canvas.getContext('2d');
  }

  function _statusColor(score) {
    if (score >= 90) return COLORS.excellent;
    if (score >= 75) return COLORS.good;
    if (score >= 60) return COLORS.acceptable;
    if (score >= 40) return COLORS.improvable;
    return COLORS.critical;
  }

  function _labelPlugin(color) {
    return {
      id: 'dp360-labels',
      afterDatasetsDraw(chart) {
        const ctx2 = chart.ctx;
        chart.data.datasets.forEach((dataset, i) => {
          chart.getDatasetMeta(i).data.forEach((bar, idx) => {
            const value = dataset.data[idx];
            if (value === null || value === undefined) return;
            ctx2.save();
            ctx2.fillStyle = color || '#374151';
            ctx2.font = '11px system-ui, sans-serif';
            ctx2.textAlign = 'center';
            ctx2.fillText(Math.round(value), bar.x, bar.y - 4);
            ctx2.restore();
          });
        });
      }
    };
  }

  // ─── 1. Score Trend Line Chart ─────────────────────────────────────────────

  /**
   * @param {string} canvasId
   * @param {Array} weeks   - ['S29','S30',...]
   * @param {Array} scores  - [72, 75, 68, ...]
   * @param {Array} [benchmarkScores] - optional fleet average line
   */
  function renderScoreTrend(canvasId, weeks, scores, benchmarkScores) {
    const ctx = _getCtx(canvasId);
    if (!ctx) return;

    const datasets = [{
      label: 'Puntaje',
      data:  scores,
      borderColor: COLORS.blue,
      backgroundColor: COLORS.blueAlpha,
      fill: true,
      tension: 0.3,
      pointRadius: 5,
      pointHoverRadius: 7,
      pointBackgroundColor: scores.map(s => _statusColor(s))
    }];

    if (benchmarkScores && benchmarkScores.length === scores.length) {
      datasets.push({
        label: 'Promedio flota',
        data: benchmarkScores,
        borderColor: COLORS.gray,
        borderDash: [5, 5],
        fill: false,
        tension: 0.3,
        pointRadius: 3,
        backgroundColor: COLORS.gray
      });
    }

    _instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: { labels: weeks, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            callbacks: {
              label: item => `${item.dataset.label}: ${item.parsed.y} pts`
            }
          }
        },
        scales: {
          y: {
            min: 0,
            max: 100,
            ticks: { stepSize: 20 },
            title: { display: true, text: 'Puntaje 0–100' }
          },
          x: { title: { display: true, text: 'Semana' } }
        }
      }
    });
  }

  // ─── 2. Driver Radar Chart ────────────────────────────────────────────────

  /**
   * @param {string} canvasId
   * @param {Object} driver - evaluated driver with safetyScore, efficiencyScore,
   *   safety.speeding.score, etc.
   */
  function renderDriverRadar(canvasId, driver) {
    const ctx = _getCtx(canvasId);
    if (!ctx) return;

    const s = driver.safety   || {};
    const e = driver.efficiency || {};

    const labels = ['Velocidad', 'Frenado', 'Aceleración', 'Giro', 'Ralentí', 'Combustible', 'Utilización'];
    const data   = [
      s.speeding           ? s.speeding.score           : 100,
      s.harshBraking       ? s.harshBraking.score       : 100,
      s.harshAcceleration  ? s.harshAcceleration.score  : 100,
      s.harshCornering     ? s.harshCornering.score     : 100,
      e.idling             ? e.idling.score             : 100,
      e.fuel               ? e.fuel.score               : 100,
      e.utilization        ? e.utilization.score        : 100
    ];

    _instances[canvasId] = new Chart(ctx, {
      type: 'radar',
      data: {
        labels,
        datasets: [{
          label: driver.driverName || 'Conductor',
          data,
          borderColor: COLORS.blue,
          backgroundColor: COLORS.blueAlpha,
          pointBackgroundColor: COLORS.blue,
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            beginAtZero: true,
            min: 0,
            max: 100,
            ticks: { stepSize: 25, backdropColor: 'transparent' },
            grid: { color: COLORS.lightGray }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: item => `${item.label}: ${item.raw} pts`
            }
          }
        }
      }
    });
  }

  // ─── 3. Score Distribution Bar Chart ─────────────────────────────────────

  /**
   * @param {string} canvasId
   * @param {Array} evaluatedDrivers
   */
  function renderScoreDistribution(canvasId, evaluatedDrivers) {
    const ctx = _getCtx(canvasId);
    if (!ctx) return;

    const buckets = [
      { label: '0–39 Crítico',      min: 0,  max: 39,  color: COLORS.critical  },
      { label: '40–59 Improvable',  min: 40, max: 59,  color: COLORS.improvable },
      { label: '60–74 Aceptable',   min: 60, max: 74,  color: COLORS.acceptable },
      { label: '75–89 Bueno',       min: 75, max: 89,  color: COLORS.good       },
      { label: '90–100 Excelente',  min: 90, max: 100, color: COLORS.excellent  }
    ];

    const counts = buckets.map(b =>
      evaluatedDrivers.filter(d => d.score >= b.min && d.score <= b.max).length
    );

    _instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: buckets.map(b => b.label),
        datasets: [{
          label: 'Conductores',
          data: counts,
          backgroundColor: buckets.map(b => b.color),
          borderRadius: 6,
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: item => `${item.raw} conductores`
            }
          }
        },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 }, title: { display: true, text: 'N° conductores' } },
          x: { title: { display: false } }
        }
      },
      plugins: [_labelPlugin()]
    });
  }

  // ─── 4. Top/Bottom Horizontal Bar Chart ───────────────────────────────────

  /**
   * @param {string} canvasId
   * @param {Array} drivers - [{driverName, score}] sorted desc (top) or asc (bottom)
   * @param {string} [title]
   */
  function renderTopDriversBar(canvasId, drivers, title) {
    const ctx = _getCtx(canvasId);
    if (!ctx) return;

    const labels = drivers.map(d => d.driverName || 'Sin nombre');
    const data   = drivers.map(d => d.score);
    const colors = data.map(s => _statusColor(s));

    _instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: title || 'Puntaje',
          data,
          backgroundColor: colors,
          borderRadius: 4,
          borderWidth: 0
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: item => `${item.raw} pts`
            }
          }
        },
        scales: {
          x: { min: 0, max: 100, ticks: { stepSize: 20 } },
          y: { ticks: { font: { size: 11 } } }
        }
      }
    });
  }

  // ─── 5. Safety Components Stacked Bar ────────────────────────────────────

  /**
   * @param {string} canvasId
   * @param {Array} evaluatedDrivers - top 10 or filtered
   */
  function renderSafetyComponents(canvasId, evaluatedDrivers) {
    const ctx = _getCtx(canvasId);
    if (!ctx) return;

    const labels = evaluatedDrivers.map(d => d.driverName || '');

    function _getComponentScore(d, key) {
      return d.safety && d.safety[key] ? (100 - d.safety[key].score) : 0; // inverted: higher bar = worse
    }

    _instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Exceso vel.',
            data: evaluatedDrivers.map(d => _getComponentScore(d, 'speeding')),
            backgroundColor: COLORS.critical,
            stack: 'safety'
          },
          {
            label: 'Frenado brusco',
            data: evaluatedDrivers.map(d => _getComponentScore(d, 'harshBraking')),
            backgroundColor: COLORS.improvable,
            stack: 'safety'
          },
          {
            label: 'Aceleración',
            data: evaluatedDrivers.map(d => _getComponentScore(d, 'harshAcceleration')),
            backgroundColor: COLORS.acceptable,
            stack: 'safety'
          },
          {
            label: 'Giro brusco',
            data: evaluatedDrivers.map(d => _getComponentScore(d, 'harshCornering')),
            backgroundColor: COLORS.good,
            stack: 'safety'
          },
          {
            label: 'Otros',
            data: evaluatedDrivers.map(d => _getComponentScore(d, 'other')),
            backgroundColor: COLORS.gray,
            stack: 'safety'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            mode: 'index',
            callbacks: {
              label: item => `${item.dataset.label}: ${item.raw.toFixed(1)} pts penalización`
            }
          }
        },
        scales: {
          x: { stacked: true, ticks: { maxRotation: 45 } },
          y: { stacked: true, title: { display: true, text: 'Penalización total' } }
        }
      }
    });
  }

  // ─── 6. Fuel Efficiency Comparison Bar ───────────────────────────────────

  /**
   * @param {string} canvasId
   * @param {Array} evaluatedDrivers
   * @param {string} [fuelType] - 'GNV' uses km/m³ label
   */
  function renderFuelComparison(canvasId, evaluatedDrivers, fuelType) {
    const ctx = _getCtx(canvasId);
    if (!ctx) return;

    const isGNV = fuelType === 'GNV';
    const label = isGNV ? 'km/m³' : 'km/L';

    const sorted = evaluatedDrivers
      .filter(d => d.efficiency && d.efficiency.fuel)
      .sort((a, b) => (b.efficiency.fuel.consumption || 0) - (a.efficiency.fuel.consumption || 0));

    const labels = sorted.map(d => d.driverName || '');
    const data   = sorted.map(d => d.efficiency.fuel.consumption || 0);
    const colors = sorted.map(d => _statusColor(d.efficiency.fuel.score || 0));

    _instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label,
          data,
          backgroundColor: colors,
          borderRadius: 4,
          borderWidth: 0
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: item => `${item.raw.toFixed(2)} ${label}`
            }
          }
        },
        scales: {
          x: { beginAtZero: true, title: { display: true, text: label } },
          y: { ticks: { font: { size: 11 } } }
        }
      }
    });
  }

  // ─── 7. Idle Rate Scatter Plot ────────────────────────────────────────────

  /**
   * @param {string} canvasId
   * @param {Array} evaluatedDrivers
   */
  function renderIdleScatter(canvasId, evaluatedDrivers) {
    const ctx = _getCtx(canvasId);
    if (!ctx) return;

    const points = evaluatedDrivers
      .filter(d => d.efficiency && d.efficiency.idling)
      .map(d => ({
        x: d.distanceKm || 0,
        y: d.efficiency.idling.idleRatePct || 0,
        label: d.driverName,
        score: d.score
      }));

    _instances[canvasId] = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [{
          label: 'Conductor',
          data: points,
          backgroundColor: points.map(p => _statusColor(p.score)),
          pointRadius: 6,
          pointHoverRadius: 9
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: item => {
                const pt = points[item.dataIndex];
                return `${pt.label}: ${pt.y.toFixed(1)}% ralentí | ${Math.round(pt.x)} km`;
              }
            }
          }
        },
        scales: {
          x: { title: { display: true, text: 'Distancia (km)' } },
          y: { title: { display: true, text: '% Ralentí' }, beginAtZero: true }
        }
      }
    });
  }

  // ─── 8. Score Improvement Before/After ───────────────────────────────────

  /**
   * @param {string} canvasId
   * @param {Array} drivers - [{driverName, prevScore, currScore}]
   */
  function renderImprovementComparison(canvasId, drivers) {
    const ctx = _getCtx(canvasId);
    if (!ctx) return;

    const labels = drivers.map(d => d.driverName || '');

    _instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Período anterior',
            data: drivers.map(d => d.prevScore || 0),
            backgroundColor: COLORS.lightGray,
            borderRadius: 4,
            borderWidth: 0
          },
          {
            label: 'Período actual',
            data: drivers.map(d => d.currScore || 0),
            backgroundColor: drivers.map(d => _statusColor(d.currScore || 0)),
            borderRadius: 4,
            borderWidth: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            mode: 'index',
            callbacks: {
              afterBody: items => {
                const idx = items[0].dataIndex;
                const d = drivers[idx];
                const delta = (d.currScore || 0) - (d.prevScore || 0);
                const arrow = delta >= 0 ? '▲' : '▼';
                return [`Variación: ${arrow} ${Math.abs(delta).toFixed(1)} pts`];
              }
            }
          }
        },
        scales: {
          y: { min: 0, max: 100, ticks: { stepSize: 20 }, title: { display: true, text: 'Puntaje' } },
          x: { ticks: { maxRotation: 45 } }
        }
      }
    });
  }

  // ─── 9. Doughnut for Status Distribution ─────────────────────────────────

  /**
   * @param {string} canvasId
   * @param {Array} evaluatedDrivers
   */
  function renderStatusDoughnut(canvasId, evaluatedDrivers) {
    const ctx = _getCtx(canvasId);
    if (!ctx) return;

    const statuses = {
      'Excelente': 0, 'Bueno': 0, 'Aceptable': 0, 'Improvable': 0, 'Crítico': 0
    };

    evaluatedDrivers.forEach(d => {
      const label = d.statusLabel || '';
      if (statuses[label] !== undefined) statuses[label]++;
      else statuses['Crítico']++;
    });

    const labels = Object.keys(statuses).filter(k => statuses[k] > 0);
    const data   = labels.map(k => statuses[k]);
    const colors = labels.map(k => STATUS_COLORS[k] || COLORS.gray);

    _instances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: COLORS.white
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: { position: 'right' },
          tooltip: {
            callbacks: {
              label: item => `${item.label}: ${item.raw} conductores`
            }
          }
        }
      }
    });
  }

  // ─── 10. KPI Gauge (score arc) ────────────────────────────────────────────

  /**
   * Simple half-donut gauge for a single score.
   * @param {string} canvasId
   * @param {number} score 0–100
   * @param {string} [label]
   */
  function renderGauge(canvasId, score, label) {
    const ctx = _getCtx(canvasId);
    if (!ctx) return;

    const clampedScore = Math.max(0, Math.min(100, score || 0));
    const fill  = clampedScore;
    const empty = 100 - fill;

    _instances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [fill, empty],
          backgroundColor: [_statusColor(clampedScore), COLORS.lightGray],
          borderWidth: 0,
          circumference: 180,
          rotation: 270
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }
        }
      },
      plugins: [{
        id: 'gauge-center',
        afterDraw(chart) {
          const { ctx: c, chartArea: { left, top, right, bottom } } = chart;
          const cx = (left + right) / 2;
          const cy = bottom - 10;
          c.save();
          c.textAlign = 'center';
          c.fillStyle = _statusColor(clampedScore);
          c.font = 'bold 28px system-ui, sans-serif';
          c.fillText(Math.round(clampedScore), cx, cy);
          if (label) {
            c.fillStyle = '#6b7280';
            c.font = '12px system-ui, sans-serif';
            c.fillText(label, cx, cy + 18);
          }
          c.restore();
        }
      }]
    });
  }

  // ─── Destroy ──────────────────────────────────────────────────────────────

  function destroyAll() {
    Object.keys(_instances).forEach(_destroy);
  }

  function destroyChart(canvasId) {
    _destroy(canvasId);
  }

  // ─── Export ───────────────────────────────────────────────────────────────

  DP360.Charts = {
    COLORS,
    renderScoreTrend,
    renderDriverRadar,
    renderScoreDistribution,
    renderTopDriversBar,
    renderSafetyComponents,
    renderFuelComparison,
    renderIdleScatter,
    renderImprovementComparison,
    renderStatusDoughnut,
    renderGauge,
    destroyAll,
    destroyChart
  };

})(window.DP360 = window.DP360 || {});

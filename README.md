# Driver Performance 360 — Add-In MyGeotab

**Versión:** 1.0.0 | **Desarrollado por:** Navisaf | **Soporte:** ocanarte@navisaf.com

---

## ¿Qué es Driver Performance 360?

Driver Performance 360 es un Add-In profesional para MyGeotab que evalúa el desempeño de conductores con una puntuación de 0 a 100, combinando **Seguridad (60%)** y **Eficiencia (40%)**.

Diseñado para flotas con vehículos de diésel, gasolina y GNV (Gas Natural Vehicular), con soporte para múltiples tipos de vehículos y una interfaz de mapeo de reglas que se adapta a cualquier base de datos de MyGeotab.

---

## Características principales

- **Puntaje 0–100** con modelo de dos pilares: Seguridad + Eficiencia
- **Modo Demo** totalmente funcional sin conexión a Geotab (40 conductores, 12 semanas de datos simulados)
- **Mapeo de Reglas** por tipo de vehículo — porque cada base de datos puede nombrar diferente las reglas de acelerómetro
- **Soporte GNV** — adaptador de combustible para km/m³ con fuente configurable
- **8 vistas** navegables: Resumen, Ranking, Perfil 360, Seguridad, Combustible & Ralentí, Mejora, Coaching y Mapeo de Reglas
- **Benchmarks dinámicos** calculados desde la flota real (P25/P50/P75) con fallback a valores configurables
- **Explicabilidad total** — cada puntaje detalla impacto por componente con valores raw/normalizados/benchmark/desviación
- **Centro de Coaching** — planes de coaching vinculados a conductores en riesgo con seguimiento de estado
- **Exportación CSV** del ranking y JSON del mapeo de reglas
- **Responsive** — funciona en escritorio, tablet y móvil. Compatible con iframe de Geotab

---

## Estructura de archivos

```
driver-performance-360/
│
├── manifest.json            ← Manifiesto del Add-In (Geotab)
├── index.html               ← Shell HTML principal
├── README.md                ← Este archivo
├── INSTALLATION.md          ← Guía de instalación y configuración
├── SCORING_MODEL.md         ← Documentación del modelo de puntuación
│
├── config/
│   ├── scoring.json         ← Pesos, umbrales y parámetros del modelo
│   ├── benchmarks.json      ← Benchmarks manuales por tipo de vehículo
│   └── vehicle-groups.json  ← Tipos de vehículo, combustible, ciudades
│
├── css/
│   ├── app.css              ← Variables CSS, layout, navegación, botones
│   ├── dashboard.css        ← KPIs, tarjetas de puntaje, perfil de conductor
│   ├── tables.css           ← Tablas de datos, paginación, ranking
│   └── responsive.css       ← Breakpoints responsive, modo Geotab, impresión
│
├── js/
│   ├── calculations.js      ← Utilidades matemáticas puras (DP360.Calc)
│   ├── score-engine.js      ← Motor central de puntuación (DP360.ScoreEngine)
│   ├── benchmarks.js        ← Cálculo de benchmarks de flota (DP360.Benchmarks)
│   ├── fuel-provider.js     ← Adaptador de combustible GNV/líquido (DP360.FuelProvider)
│   ├── storage.js           ← Persistencia localStorage (DP360.Storage)
│   ├── mock-data.js         ← Datos simulados para modo demo (DP360.MockData)
│   ├── filters.js           ← Estado y renderizado de filtros (DP360.Filters)
│   ├── api.js               ← Proveedor de datos (real/mock) (DP360.API)
│   ├── charts.js            ← Gráficos Chart.js (DP360.Charts)
│   └── main.js              ← Controlador SPA y registro Geotab (DP360.App)
│
└── views/
    ├── fleet.js             ← Vista: Resumen de Flota
    ├── ranking.js           ← Vista: Ranking de Conductores
    ├── driver.js            ← Vista: Perfil 360 del Conductor
    ├── safety.js            ← Vista: Análisis de Seguridad
    ├── fuel.js              ← Vista: Combustible & Ralentí
    ├── improvement.js       ← Vista: Análisis de Mejora
    ├── coaching.js          ← Vista: Centro de Coaching
    └── rule-mapping.js      ← Vista: Mapeo de Reglas
```

---

## Modo Demo

El Add-In incluye **40 conductores simulados** con datos realistas para las semanas W29–W40 del 2026:

- 15 Camiones Diésel
- 15 Camionetas Gasolina
- 7 Livianos Gasolina
- 3 Camiones GNV

Activar/desactivar con el botón **"MODO DEMO / DATOS REALES"** en el encabezado.

Para forzar modo demo al arrancar sin Geotab: el Add-In detecta automáticamente si no está dentro del frame de MyGeotab y activa el modo demo.

---

## Dependencias externas

| Librería | Versión | CDN |
|----------|---------|-----|
| Chart.js | 4.4.4 | cdnjs.cloudflare.com |

No se requieren otras dependencias externas. El Add-In es autocontenido.

---

## Versionado

Este Add-In sigue versionado semántico:
- **MAJOR** — cambio estructural o funcional importante
- **MINOR** — nueva funcionalidad compatible
- **PATCH** — corrección o ajuste menor

### Historial
| Versión | Fecha | Descripción |
|---------|-------|-------------|
| 1.0.0 | 2026-10-06 | Versión inicial completa |

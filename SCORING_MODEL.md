# Modelo de Puntuación — Driver Performance 360

## Principio general

El puntaje de cada conductor es un número de **0 a 100** calculado sobre un período de tiempo y una distancia mínima.

La fórmula principal:

```
Puntaje Final = (Puntaje Seguridad × 0.60) + (Puntaje Eficiencia × 0.40)
```

Cada sub-puntaje también va de 0 a 100. Partimos de 100 puntos y aplicamos penalizaciones basadas en frecuencia de eventos.

---

## Pilar 1: Seguridad (60% del puntaje final)

### Componentes y pesos dentro del pilar de Seguridad

| Componente | Peso | Reglas Asociadas |
|------------|------|-----------------|
| Velocidad Excesiva | 25% | `speeding` |
| Frenada Brusca | 25% | `harsh_braking` |
| Aceleración Brusca | 20% | `harsh_accel` |
| Curva Brusca | 15% | `harsh_cornering` |
| Otras de Seguridad | 15% | `other_safety` |

### Fórmula por componente

```
Métrica = Eventos del Componente / Kilómetros × 100   → Eventos por 100km

Penalización = Métrica / Escala × Peso_Componente × 100

Puntaje Componente = max(0, 100 − (Penalización / Peso_Componente × 100))

Puntaje Seguridad = 100 − Σ(Penalización_i)   con floor en 0
```

La **Escala** es el valor de referencia en config/scoring.json. Por ejemplo, si la escala de frenadas es 5.0, un conductor con 5 frenadas/100km recibe la penalización máxima para ese componente.

---

## Pilar 2: Eficiencia (40% del puntaje final)

### Componentes y pesos dentro del pilar de Eficiencia

| Componente | Peso | Métrica |
|------------|------|---------|
| Ralentí | 40% | Horas de ralentí / Horas de conducción |
| Combustible | 45% | km/L o km/m³ vs benchmark |
| Utilización | 15% | Horas de conducción / Horas disponibles |

### Fórmulas de Eficiencia

**Ralentí:**
```
Ratio Ralentí = Horas Ralentí / Horas Conducción
Penalización Ralentí = max(0, Ratio − Umbral_Bueno) / (Umbral_Máx − Umbral_Bueno) × 100
Puntaje Ralentí = max(0, 100 − Penalización × Peso_Ralentí)
```

**Combustible (Diésel/Gasolina en km/L):**
```
Desviación = (Rendimiento_Real − Benchmark) / Benchmark
Puntaje Combustible = min(100, max(0, 100 + Desviación × 100))
```

**Combustible GNV (km/m³):**
```
Igual que combustible líquido pero usando km/m³ como unidad base.
El benchmark GNV se configura por tipo de vehículo en config/benchmarks.json.
```

**Utilización:**
```
Ratio Utilización = Horas Conducción / Horas Disponibles
Puntaje Utilización = min(100, Ratio × 100 / Umbral_Objetivo)
```

---

## Normalización: Eventos por 100km

Todos los eventos de seguridad se normalizan a **eventos por 100 kilómetros** para permitir comparaciones justas entre conductores con diferentes distancias recorridas.

```
Eventos / 100km = (Total Eventos / Total km) × 100
```

Un conductor que recorrió 50km con 2 frenadas tiene la misma métrica que uno que recorrió 500km con 20 frenadas: **4 frenadas/100km**.

---

## Estados de evaluación

Según la distancia recorrida en el período:

| Estado | Kilómetros | Descripción |
|--------|-----------|-------------|
| `insufficient` | < 100 km | Sin evaluación — datos insuficientes |
| `provisional` | 100 – 499 km | Evaluación provisional — datos limitados |
| `full` | ≥ 500 km | Evaluación completa |

Los conductores con estado `insufficient` se excluyen del ranking principal.

---

## Categorías de desempeño

| Categoría | Rango | Color |
|-----------|-------|-------|
| Excelente | 90 – 100 | Verde oscuro |
| Bueno | 75 – 89 | Verde |
| Aceptable | 60 – 74 | Ámbar |
| Mejorable | 45 – 59 | Naranja |
| Crítico | 0 – 44 | Rojo |

---

## Benchmarks dinámicos

El sistema calcula benchmarks desde la flota activa usando percentiles:

```
P25  → Benchmark mínimo (conductores por debajo requieren atención)
P50  → Benchmark mediana (promedio de la flota)
P75  → Benchmark objetivo (desempeño superior)
```

Si la flota tiene menos de 5 conductores con evaluación completa, se usan los **benchmarks manuales** definidos en `config/benchmarks.json`.

Los benchmarks se calculan por tipo de vehículo cuando hay suficientes datos, o globalmente como fallback.

---

## Desviación del benchmark

Para cada componente, se calcula la desviación del conductor respecto al benchmark P50 de su grupo:

```
Desviación = ((Métrica_Conductor − Benchmark_P50) / Benchmark_P50) × 100
```

Un valor positivo indica que el conductor tiene más eventos que el promedio (peor). Un valor negativo indica mejor desempeño.

---

## Mapeo de reglas

El sistema no asume nombres fijos para las reglas de excepción. En cambio, el administrador asigna cada regla de MyGeotab a una categoría de puntuación mediante la interfaz de Mapeo de Reglas.

### Nivel de resolución

El sistema usa dos niveles de lookup para clasificar un evento:

1. **Mapeo por tipo de vehículo** (ej: "Camión" → speeding)
2. **Mapeo por defecto** (global, fallback cuando no hay mapeo específico)

Si una regla no está en ningún mapeo, el evento se ignora.

### Ejemplo de configuración

```json
{
  "default": {
    "ruleId-abc123": "harsh_braking",
    "ruleId-def456": "speeding"
  },
  "Camión": {
    "ruleId-ghi789": "harsh_accel",
    "ruleId-abc123": "harsh_braking"
  }
}
```

En este ejemplo, un evento de "ruleId-abc123" para un Camión usa el mapeo de "Camión", mientras que para una Camioneta usa el mapeo "default".

---

## Explainability

Cada puntaje calculado incluye el detalle completo de su construcción:

```json
{
  "finalScore": 73,
  "safetyScore": 68,
  "efficiencyScore": 81,
  "breakdown": {
    "safety": {
      "baseScore": 100,
      "items": [
        {
          "label": "Velocidad Excesiva",
          "rawEvents": 12,
          "per100km": 2.4,
          "benchmark": 1.8,
          "deviation": 33.3,
          "impact": -8.5,
          "weight": 0.25
        }
      ]
    }
  }
}
```

Este nivel de detalle permite al supervisor explicar exactamente por qué un conductor obtuvo su puntaje.

---

## Parámetros configurables (config/scoring.json)

| Parámetro | Descripción | Valor por defecto |
|-----------|-------------|------------------|
| `weights.safety` | Peso del pilar Seguridad | 0.60 |
| `weights.efficiency` | Peso del pilar Eficiencia | 0.40 |
| `safety.speeding.weight` | Peso Velocidad Excesiva dentro de Seguridad | 0.25 |
| `safety.harsh_braking.weight` | Peso Frenada Brusca dentro de Seguridad | 0.25 |
| `safety.harsh_accel.weight` | Peso Aceleración Brusca dentro de Seguridad | 0.20 |
| `safety.harsh_cornering.weight` | Peso Curva Brusca dentro de Seguridad | 0.15 |
| `safety.other_safety.weight` | Peso Otras Seguridad dentro de Seguridad | 0.15 |
| `efficiency.idle.weight` | Peso Ralentí dentro de Eficiencia | 0.40 |
| `efficiency.fuel.weight` | Peso Combustible dentro de Eficiencia | 0.45 |
| `efficiency.utilization.weight` | Peso Utilización dentro de Eficiencia | 0.15 |
| `evaluation.minKmProvisional` | Km mínimos para evaluación provisional | 100 |
| `evaluation.minKmFull` | Km mínimos para evaluación completa | 500 |

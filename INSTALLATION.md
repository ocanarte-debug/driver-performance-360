# Guía de Instalación — Driver Performance 360

## Requisitos

- MyGeotab (cualquier versión reciente con soporte Add-Ins)
- Permisos de administrador en la base de datos objetivo
- Acceso a la sección **Administration → System → System Settings → Add-Ins**

---

## Opción A: Instalación desde URL pública

Si el Add-In está alojado en un servidor web accesible desde Internet:

1. Ir a **Administration → System → System Settings → Add-Ins**
2. Hacer clic en **Add**
3. Pegar la URL del `manifest.json`:
   ```
   https://tu-servidor.com/driver-performance-360/manifest.json
   ```
4. Hacer clic en **OK** y luego **Save**
5. Refrescar MyGeotab — el Add-In aparecerá en el menú lateral bajo **Driver Performance 360**

---

## Opción B: Instalación local (intranet o desarrollo)

Si el servidor no es accesible desde Internet, usar la instalación manual:

1. Copiar toda la carpeta `driver-performance-360/` a tu servidor web interno
2. Verificar que el servidor tenga CORS habilitado si Geotab está en un dominio diferente
3. Seguir los pasos de la Opción A con la URL interna

---

## Opción C: Instalación desde archivo ZIP (modo desarrollo)

Para pruebas locales sin servidor:

1. Abrir `index.html` directamente en el navegador (no dentro de Geotab)
2. El Add-In detecta que no está en el frame de MyGeotab y activa **Modo Demo** automáticamente
3. Todos los datos son simulados — no se realiza ninguna conexión a Geotab

---

## Primera configuración

### 1. Verificar el Modo Demo

Al abrir el Add-In por primera vez, verificar que el badge en el encabezado muestre **"MODO DEMO"** (fondo verde). Si no aparece, hacer clic en el botón **"MODO DEMO"** en el encabezado.

### 2. Configurar el Mapeo de Reglas (CRÍTICO para producción)

> **Este paso es obligatorio antes de usar datos reales.** Las reglas de excepción en MyGeotab varían por cliente y configuración de acelerómetro.

1. Navegar a la vista **Mapeo de Reglas** (ícono ⚙️ en el menú)
2. Seleccionar la pestaña del tipo de vehículo a configurar (ej: Camión, Camioneta)
3. Para cada fila de regla, hacer clic en el selector de la columna **Categoría** y asignar la categoría correcta:
   - `speeding` — Velocidad Excesiva
   - `harsh_braking` — Frenada Brusca
   - `harsh_accel` — Aceleración Brusca
   - `harsh_cornering` — Curva Brusca
   - `other_safety` — Otra Seguridad
   - `idle` — Ralentí
   - `ignore` — Ignorar (no participa en el puntaje)
4. Las reglas sin asignar muestran el badge **DEFAULT** y usan la configuración global
5. Hacer clic en **Guardar Cambios** para persistir el mapeo

**Identificar reglas disponibles:** Ir a MyGeotab → Administration → Rules & Groups → Rules. Los nombres ahí son los que aparecerán en el mapeo.

### 3. Cambiar a datos reales

Una vez configurado el mapeo de reglas:

1. Hacer clic en el botón **"MODO DEMO"** en el encabezado
2. Confirmar el cambio — el badge cambiará a **"DATOS REALES"**
3. El Add-In cargará datos desde la base de datos de MyGeotab activa

---

## Configuración avanzada

### Umbrales de puntuación (config/scoring.json)

Editar `config/scoring.json` para ajustar:
- Pesos de cada componente de seguridad y eficiencia
- Km mínimos para evaluación completa (`evaluationThresholdFull: 500`)
- Escala de penalización por eventos por 100km

### Benchmarks manuales (config/benchmarks.json)

Si la flota es pequeña (menos de 5 conductores por tipo), los percentiles dinámicos pueden no ser representativos. Editar `config/benchmarks.json` para definir benchmarks fijos por tipo de vehículo.

### Tipos de vehículo y combustible (config/vehicle-groups.json)

Editar `config/vehicle-groups.json` para agregar nuevos tipos de vehículo, ciudades o tipos de operación que reflejen la estructura real de la flota.

### Soporte GNV

Para activar el soporte de Gas Natural Vehicular:
1. Asegurarse de que los vehículos GNV tengan `fuelType: "GNV"` en `vehicle-groups.json`
2. Configurar el proveedor de datos GNV en `js/fuel-provider.js` según la fuente disponible (CSV, API externa, datos manuales)

---

## Solución de problemas

| Problema | Causa probable | Solución |
|----------|---------------|----------|
| El Add-In no aparece en el menú | URL incorrecta en manifest.json | Verificar que la URL sea accesible y el JSON sea válido |
| "No hay datos suficientes" en todas las vistas | Modo Demo apagado sin mapeo de reglas configurado | Configurar el mapeo de reglas primero |
| Gráficos no cargan | CDN de Chart.js bloqueado por proxy | Descargar Chart.js localmente y actualizar la referencia en index.html |
| Puntajes de 100 para todos | Reglas no asignadas (todas en "ignore") | Revisar el mapeo de reglas y asignar las categorías correctas |
| Error de CORS | Servidor sin encabezados CORS | Configurar `Access-Control-Allow-Origin: *` en el servidor |
| Datos de GNV no aparecen | Sin conductores con fuelType=GNV | Verificar vehicle-groups.json y la fuente de datos GNV |

---

## Notas de seguridad

- El Add-In **solo lee datos** de MyGeotab — no realiza ninguna escritura en la base de datos
- El mapeo de reglas y los planes de coaching se almacenan en **localStorage del navegador** del usuario — son locales por dispositivo
- No se envían datos a servidores externos

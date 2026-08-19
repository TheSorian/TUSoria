# TUSoria — Roadmap de desarrollo

> Documento maestro de planificación y ejecución de TUSoria.
>
> Este documento define el orden de desarrollo, los objetivos de cada fase,
> las decisiones arquitectónicas consolidadas y los criterios mínimos para
> considerar una fase terminada.
>
> **Este documento debe ser respetado por cualquier agente que trabaje en el
> proyecto.**
>
> El roadmap puede evolucionar cuando el análisis del código o la
> implementación descubran nueva información, pero ningún agente debe
> modificar silenciosamente los objetivos de una fase ni inventar requisitos
> no respaldados por el proyecto.

---

# 0. REGLAS DE USO DEL ROADMAP

## 0.1. El código real es la autoridad sobre el estado

Los estados `COMPLETADA`, `PENDIENTE`, etc. representan el estado conocido
cuando se creó este documento.

Antes de implementar cualquier fase, el agente debe comprobar el estado
real del repositorio.

No debe asumir que una tarea está terminada únicamente porque aparece
marcada con `✅`.

---

## 0.2. No saltar fases

El desarrollo debe seguir el orden:

```text
Fase 0
  ↓
Fase 1
  ↓
Fase 2
  ↓
Fase 3
  ↓
Fase 4
  ↓
Fase 5
  ↓
Fase 6
```

Las subfases pueden introducirse cuando sean necesarias, pero no deben
utilizarse para saltar el objetivo de una fase.

---

## 0.3. No inventar requisitos

Si el historial o el código disponible no permiten determinar con certeza
qué se había decidido:

1. No inventar la decisión.
2. Identificar explícitamente la incertidumbre.
3. Analizar el código existente.
4. Proponer una interpretación.
5. Documentar la propuesta antes de convertirla en una decisión
   arquitectónica.

---

## 0.4. No romper decisiones consolidadas

Las decisiones incluidas en:

```text
PRINCIPIOS ARQUITECTÓNICOS CONSOLIDADOS
```

deben considerarse restricciones del sistema.

Un cambio sobre ellas requiere una justificación técnica explícita.

---

## 0.5. Cada fase debe tener una puerta de calidad

Una fase no se considera terminada hasta comprobar, como mínimo:

```text
tests
lint
build
validación funcional
```

Si alguna comprobación falla:

```text
FASE = NO COMPLETADA
```

aunque la implementación principal parezca terminada.

---

## 0.6. Cambios descubiertos durante la implementación

Si durante una fase aparecen nuevas necesidades:

- no ocultarlas;
- no convertirlas automáticamente en requisitos de la fase actual;
- documentarlas;
- determinar si pertenecen a la fase actual, a una fase posterior o
  requieren una nueva subfase.

Las nuevas subfases deben mantener la trazabilidad.

Ejemplo:

```text
1.3
1.3b
1.3c
1.4
```

No crear una nueva fase principal simplemente porque durante el desarrollo
aparezca una dificultad adicional.

---

# 1. PROTOCOLO DE TRABAJO DE ANTIGRAVITY

Antes de modificar código para una nueva fase, Antigravity debe realizar
el siguiente proceso.

## Paso 1 — Auditar

Inspeccionar:

- estructura del proyecto;
- código relevante;
- tests;
- configuración;
- datos estáticos;
- API;
- servicios realtime;
- planner;
- componentes que consuman realtime;
- configuración Vercel;
- configuración de desarrollo local.

---

## Paso 2 — Comparar con el roadmap

Determinar:

```text
ROADMAP
   ↓
ESTADO ESPERADO
   ↓
ESTADO REAL DEL REPOSITORIO
```

Y producir una lista de:

- confirmado;
- parcialmente implementado;
- pendiente;
- inconsistente;
- desconocido.

---

## Paso 3 — No implementar todavía si existe una discrepancia importante

Si el estado real no coincide con el roadmap, primero documentar la
discrepancia y decidir cómo resolverla.

---

## Paso 4 — Crear un plan de implementación

Antes de realizar cambios importantes, definir:

- archivos afectados;
- comportamiento esperado;
- tests necesarios;
- riesgos;
- compatibilidad con la arquitectura actual;
- criterios de aceptación.

---

## Paso 5 — Implementar incrementalmente

Realizar cambios pequeños y verificables.

Después de cada cambio relevante:

```text
tests
↓
lint
↓
build
```

---

## Paso 6 — Validar la fase

Comprobar los criterios de aceptación de la fase.

Solo entonces actualizar el estado del roadmap.

---

# 2. ESTADO ACTUAL

**Fase actual conocida: 1.3c — COMPLETADA**

Antes de comenzar 1.4:

> **OBLIGATORIO:** auditar el repositorio y confirmar que este estado sigue
> siendo correcto.

---

# FASE 0 — FOUNDATIONS

## Objetivo

Construir la base funcional de TUSoria antes de abordar el tiempo real
avanzado.

## Alcance

- Estructura inicial de la aplicación.
- Aplicación web/PWA.
- Mapa de Soria.
- Datos de paradas.
- Datos de líneas.
- Horarios de Avanza.
- Geometrías de las líneas.
- Buscador.
- Primer planificador de rutas.
- Representación de autobuses.
- Arquitectura inicial de servicios.
- Tests iniciales.
- Preparación del despliegue.
- Despliegue inicial en Vercel.

## Estado

**COMPLETADA**

---

# FASE 1 — TIEMPO REAL FIABLE

## Objetivo general

Conseguir que TUSoria pueda proporcionar información de llegada en tiempo
real de forma fiable, resistente a los problemas de la API de Avanza y sin
generar una cantidad innecesaria de tráfico.

---

# FASE 1.1 — API ETA SEGURA

## Objetivo

Crear `/api/eta` como proxy controlado entre TUSoria y Avanza.

## Alcance

- Proxy hacia Avanza.
- Validación de `stopId`.
- Control de errores.
- Contrato HTTP consistente.
- Respuestas de error apropiadas.
- Evitar acceso directo del cliente a la infraestructura externa.
- Preparación para caching.
- Validación defensiva de parámetros.

## Estado

**COMPLETADA**

---

# FASE 1.2 — DESPLIEGUE Y COMPATIBILIDAD

## 1.2a — Vercel

### Objetivo

Garantizar que `/api/eta` funcione correctamente como Serverless Function
de Vercel.

### Alcance

- Compatibilidad con runtime Serverless.
- Contrato correcto del handler.
- Caché del proxy.
- Despliegue real.
- Compatibilidad con producción.

### Estado

**COMPLETADA**

---

## 1.2b — Desarrollo local

### Objetivo

Conseguir que `/api/eta` tenga el mismo comportamiento durante
desarrollo local con Vite que en producción.

### Solución consolidada

Middleware de Vite reutilizando directamente:

```text
api/eta.js
```

sin duplicar la lógica de negocio.

### Alcance

- `api/devProxy.js`.
- Integración en `vite.config.js`.
- Adaptación de `req.query`.
- Adaptación de `res.status()`.
- Adaptación de `res.json()`.
- Sin introducir Express ni dependencias innecesarias.
- Tests del adaptador.
- Verificación mediante peticiones reales a localhost.

### Estado

**COMPLETADA**

---

## 1.2c — TLS Avanza

### Problema

Node.js no podía validar correctamente la cadena de certificados de
Avanza:

```text
UNABLE_TO_VERIFY_LEAF_SIGNATURE
```

### Solución consolidada

- Certificado intermedio oficial de Sectigo.
- `https.Agent` dedicado.
- `rejectUnauthorized: true`.
- Mantenimiento de la validación TLS.
- Inclusión explícita del certificado en Vercel.
- Tests criptográficos del certificado.
- Sustitución del `fetch()` utilizado para la comunicación con Avanza por
  `node:https`.

### Restricción

**Nunca desactivar la validación TLS para solucionar problemas de Avanza.**

### Estado

**COMPLETADA**

---

# FASE 1.3 — CONSOLIDACIÓN DEL REALTIME

## Objetivo

Convertir `LiveDataContext` en el punto central de información realtime
del cliente.

### Arquitectura

Antes:

```text
Mapa ──────┐
Modal ─────┼──> Avanza
Planner ───┘
```

Después:

```text
              LiveDataContext
                    │
          ┌─────────┼─────────┐
          ↓         ↓         ↓
        Mapa      Modal    Planner
```

## Alcance

- `liveBuses`.
- `lastUpdated`.
- `isLoading`.
- `isStale`.
- `error`.
- `getStopETAs(stopId)`.
- Polling centralizado.
- Eliminación de polling solapado.
- Caché de ETA.
- Reutilización de información realtime.
- Integración del planner con el contexto.
- Reducción de peticiones redundantes.

## Polling

Se sustituyó el `setInterval` por polling recursivo mediante `setTimeout`,
evitando que dos ciclos estén simultáneamente en vuelo.

## Backoff

```text
8 s → 12 s → 20 s → 30 s → 60 s
```

## Estado

**COMPLETADA**

---

# FASE 1.3b — MOTOR ETA TOPOLÓGICO

## Objetivo

Sustituir las estimaciones simplistas basadas únicamente en
distancia/GPS por un motor que entienda la topología real de las líneas y
las peculiaridades de las expediciones de Avanza.

---

## 1. `num` ≠ `stopId`

En `avanzaSchedules.js`:

```text
num = posición de la parada en el recorrido
```

y no:

```text
num = stopId
```

Se creó:

```text
src/data/topologyMap.js
```

para relacionar posición topológica y `stopId` físico.

---

## 2. Blacklist de paradas problemáticas

La auditoría de las 89 paradas reveló:

- rate limiting de Avanza;
- IDs compartidos entre ciudades;
- contaminación con datos de Benidorm y Rubí;
- 21 IDs problemáticos.

Se creó:

```text
BROKEN_STOPS_BLACKLIST
```

---

## 3. Jerarquía ETA

La jerarquía consolidada es:

```text
REAL
  ↓
INTERPOLATED
  ↓
GPS
  ↓
SCHEDULED
```

---

## 4. Interpolación mediante anclas

Cuando Avanza no devuelve directamente la parada objetivo:

```text
OBJETIVO
   ↑
parada anterior
   ↑
parada anterior
   ↑
parada anterior
   ↑
ANCLA REAL DE AVANZA
```

La ETA se obtiene mediante:

```text
ETA objetivo =
ETA real del ancla
+
diferencia programada entre ancla y objetivo
```

La búsqueda es progresiva, no una batería simultánea de consultas.

---

## 5. Prolongaciones y `effectiveTopology`

Se detectó que las líneas L1, L2 y L3 pueden tener diferentes recorridos
según la expedición.

`effectiveTopology` representa únicamente las paradas que visita la
expedición concreta.

Debe resolver:

- prolongaciones;
- recorridos normales;
- viajes cortos;
- `null` en matrices de horarios.

---

## 6. Resolución de `tripIdx`

Para resolver:

```text
necesito tripIdx para buscar el ancla
pero necesito el ancla para conocer tripIdx
```

se implementó:

```text
tripIdx provisional
        ↓
búsqueda de ancla
        ↓
ETA REAL
        ↓
tripIdx definitivo
        ↓
effectiveTopology definitiva
        ↓
ETA final
```

El `tripIdx` provisional nunca es la autoridad final.

---

## 7. Viajes cortos

Cuando una expedición provisional no contiene la parada objetivo:

```text
targetIndices.length === 0
```

el motor busca una expedición compatible que sí la contenga.

---

## 8. Líneas circulares

Se resolvieron:

- paradas físicas repetidas;
- diferentes posiciones topológicas de una misma parada;
- wrap-around;
- selección de la instancia correcta;
- sentido de circulación.

---

## 9. GPS

Cuando no existe un ancla real disponible, el motor puede utilizar:

- posición del bus;
- sentido;
- topología;
- distancia sobre el trazado;
- memoria del estado del bus.

## Estado

**COMPLETADA**

---

# FASE 1.3c — INTEGRACIÓN REALTIME + MOTOR ETA

## Objetivo

Integrar el motor de la Fase 1.3b con `LiveDataContext` sin sacrificar ni
la precisión de las ETAs ni la reducción de tráfico conseguida en 1.3.

---

## Jerarquía definitiva

```text
getStopETAs(stopId)
       │
       ├── Cache 15 s
       │
       ├── Promise Locking
       │
       ├── REAL
       │
       ├── INTERPOLATED
       │      └── búsqueda HTTP progresiva de anclas
       │
       ├── GPS
       │
       └── SCHEDULED
```

## Caché

Caché cliente de:

```text
15 segundos
```

La interpolación no debe convertirse en una caché estática. Cuando
necesita calcularse, vuelve a utilizar la información disponible.

---

## Promise Locking

Se utiliza un registro de Promises pendientes para impedir que dos
solicitudes simultáneas de la misma parada produzcan dos peticiones
idénticas.

---

## Fresh / Stale / Dead

```text
< 25 s       FRESH
25–120 s     STALE
> 120 s      DEAD
```

`STALE` no significa inutilizable.

Los datos pueden seguir utilizándose para estimaciones.

Solo un snapshot `DEAD` se descarta completamente para realtime.

---

## Interpolación HTTP

La integración conserva deliberadamente la búsqueda HTTP progresiva de
anclas.

No sustituirla automáticamente por:

- una batería simultánea de consultas;
- una consulta a múltiples hubs;
- una simple interpolación geométrica sobre `liveBuses`.

Debe conservar:

- timeout por parada;
- timeout global;
- blacklist;
- effective topology;
- resolución de `tripIdx`.

---

## Route Planner

`routePlanner.js` continúa siendo independiente de React.

Puede recibir:

```text
getStopETAs
```

mediante inyección.

Cuando no existe inyección, utiliza el mismo motor unificado.

---

## StopDetailModal

Utiliza:

```text
getStopETAs(stop.id)
```

y se beneficia de:

- caché;
- Promise Locking;
- motor topológico;
- GPS;
- fallback programado.

---

## Estado validado

- 80/80 tests.
- 0 errores de lint.
- Build correcto.
- Integración local verificada.

## Estado

**COMPLETADA**

---

# FASE 1.4 — CONSOLIDACIÓN Y VALIDACIÓN FINAL DEL REALTIME

## Estado

**PENDIENTE**

## Importante

El historial disponible confirma que 1.4 era el siguiente bloque, pero no
conserva con suficiente precisión el listado literal de tareas originales.

Por tanto:

> **NO INVENTAR el contenido original de 1.4.**

Antes de implementarla, Antigravity debe auditar el repositorio y el
historial disponible y determinar qué queda realmente pendiente en el
sistema realtime.

## Objetivo

Realizar la validación final del sistema realtime antes de pasar a
routing.

La Fase 1.4 debe comprobar, como mínimo, que todo el sistema construido
en 1.1–1.3c funciona conjuntamente y no solo de forma aislada.

## Áreas a auditar

### ETA

Comprobar:

- REAL;
- INTERPOLATED;
- GPS;
- SCHEDULED;
- stale;
- dead;
- ausencia de ETA duplicadas;
- orden correcto de las ETAs;
- consistencia temporal.

### Topología

Comprobar especialmente:

- L1;
- L2;
- L3;
- prolongaciones;
- viajes cortos;
- circulares;
- paradas repetidas;
- `null`;
- `tripIdx`;
- `effectiveTopology`.

### API

Comprobar:

- `/api/eta`;
- errores;
- timeouts;
- TLS;
- blacklist;
- rate limiting;
- comportamiento local;
- comportamiento Vercel.

### Concurrencia

Comprobar:

- Promise Locking;
- ausencia de peticiones duplicadas;
- polling serializado;
- backoff;
- cancelación/limpieza cuando corresponda.

### Consumo

Comprobar que no existan:

- antiguos fallbacks redundantes;
- polling paralelo;
- peticiones duplicadas;
- consultas innecesarias a Avanza.

### Cliente

Comprobar:

- `LiveDataContext`;
- mapa;
- `StopDetailModal`;
- planner;
- consumo de `getStopETAs`.

## Criterio de salida

La Fase 1.4 solo puede marcarse como completada cuando:

```text
tests        → OK
lint         → OK
build        → OK
realtime     → validado
topología    → validada
concurrencia → validada
API          → validada
```

Y cualquier problema encontrado debe quedar documentado.

---

# FASE 2 — ROUTING CORRECTO

## Objetivo

Convertir el planificador de rutas en un sistema realmente fiable,
teniendo en cuenta no solo la topología sino también el tiempo.

El planificador debe ser capaz de combinar:

```text
Origen
  ↓
paradas candidatas
  ↓
líneas
  ↓
topología
  ↓
tiempos
  ↓
transbordos
  ↓
ETA
  ↓
ruta óptima
```

## Áreas

- Dijkstra.
- Topología correcta de las líneas.
- Dirección.
- Paradas candidatas.
- Tiempos de espera.
- Transbordos.
- ETA realtime.
- Integración de horarios.
- Evitar rutas geométricamente cortas pero temporalmente peores.

## Requisito arquitectónico

El planner debe permanecer independiente de React.

Las dependencias realtime deben entrar mediante inyección.

## Estado

**PENDIENTE**

---

# FASE 3 — SINCRONIZACIÓN AVANZADA CON AVANZA

## Objetivo

Gestionar correctamente las peculiaridades y cambios de los datos de
Avanza.

## Áreas

- Cambios de horarios.
- Nuevas expediciones.
- Modificaciones de líneas.
- Prolongaciones.
- Excepciones.
- Cambios de recorrido.
- Coherencia entre datos estáticos y realtime.
- Tratamiento robusto de peculiaridades de la API.

## Nota

Parte de esta problemática ya ha sido adelantada durante las Fases 1.3b
y 1.3c.

No duplicar trabajo ya resuelto.

## Estado

**PENDIENTE**

---

# FASE 4 — RENDIMIENTO

## Objetivo

Optimizar TUSoria una vez que la lógica funcional y realtime sea correcta.

## Áreas

- Reducir peticiones innecesarias.
- Optimizar cachés.
- Optimizar cálculos.
- Reducir renders.
- Optimizar mapa.
- Optimizar memoria.
- Optimizar bundle.
- Mejorar tiempos de carga.
- Optimizar infraestructura Vercel/CDN.
- Medir rendimiento real.

## Principio

No realizar optimizaciones prematuras que comprometan la precisión del
realtime.

Primero:

```text
correcto
```

Después:

```text
rápido
```

## Estado

**PENDIENTE**

---

# FASE 5 — UX / ACCESIBILIDAD / PRODUCTO

## Objetivo

Pasar de una aplicación funcional a una experiencia de usuario sólida.

## Accesibilidad

- Contraste.
- Tamaños.
- Estados.
- Etiquetas.
- Navegación.
- Accesibilidad del mapa.

## Búsqueda

- Búsqueda de paradas.
- Búsqueda de direcciones.
- Sugerencias.
- UX de búsqueda.

## Alertas

- Incidencias.
- Avisos.
- Interrupciones.
- Cambios de servicio.

## Estado

**PENDIENTE**

---

# FASE 6 — PWA / PRODUCTO FINAL

## Objetivo

Pulir TUSoria para su utilización como producto final.

## Áreas

- Instalación PWA.
- Experiencia móvil.
- Offline razonable.
- Manifest.
- Iconos.
- Splash.
- Notificaciones, si procede.
- Estados vacíos.
- Gestión de errores.
- Onboarding.
- Pulido visual.
- Publicación.

## Estado

**PENDIENTE**

---

# PRINCIPIOS ARQUITECTÓNICOS CONSOLIDADOS

Estas decisiones forman parte del estado actual del proyecto y no deben
revertirse sin una decisión explícita.

---

## ETA

```text
REAL → INTERPOLATED → GPS → SCHEDULED
```

---

## Interpolación

La interpolación mediante anclas utiliza **consultas HTTP progresivas a
Avanza**.

No sustituir automáticamente por:

- consultas simultáneas;
- múltiples hubs;
- simple interpolación geométrica.

---

## `num` y `stopId`

Nunca asumir:

```text
num === stopId
```

`num` representa posición topológica.

---

## Topología

La topología efectiva depende de la expedición concreta.

Debe respetar:

- `tripIdx`;
- `null`;
- viajes cortos;
- prolongaciones;
- circulares;
- paradas repetidas.

---

## Realtime

`LiveDataContext` es el punto central de verdad para el estado realtime
del cliente.

---

## Frescura

```text
fresh  < 25 s
stale  25–120 s
dead   > 120 s
```

`stale` no equivale a `dead`.

---

## TLS

Nunca desactivar la verificación TLS para solucionar problemas de Avanza.

---

## Peticiones

Evitar:

- polling solapado;
- consultas duplicadas;
- ráfagas innecesarias;
- antiguos fallbacks redundantes.

---

## Planner

`routePlanner.js` debe permanecer independiente de React y recibir las
dependencias realtime mediante inyección.

---

# CRITERIOS GENERALES DE CALIDAD

Todo cambio debe intentar mantener:

```text
correctness
reliability
testability
maintainability
```

en ese orden.

No aceptar una mejora de rendimiento que reduzca la fiabilidad del ETA.

No aceptar una simplificación de código que destruya casos topológicos
ya resueltos.

No eliminar tests existentes para hacer que una fase pase.

Si un test existente contradice una nueva decisión arquitectónica, primero
analizar la contradicción y documentarla.

### Limpieza de la raíz del proyecto

Todos los scripts auxiliares, utilidades de scraping, scripts temporales o de
investigación empírica deben ubicarse en `scripts/` o `scratch/`, evitando
acumular archivos temporales en la raíz del repositorio.

---

# TESTS Y VALIDACIÓN

Como mínimo, antes de cerrar una fase:

```text
npm test
npm run lint
npm run build
```

La suite automatizada cuenta con una línea base mínima (actualmente 80 tests)
que **no debe decrecer**. Toda nueva funcionalidad o corrección debe incorporar
sus propios tests de integración y regresión.

Si el proyecto utiliza comandos diferentes, Antigravity debe descubrirlos
en `package.json` y utilizar los comandos reales del proyecto.

Además de los tests unitarios, las partes críticas deben validarse
funcionalmente cuando sea posible.

---

# HISTORIAL DE EJECUCIÓN

| Fase | Estado |
|---|---|
| 0 — Foundations | ✅ |
| 1.1 — API ETA segura | ✅ |
| 1.2a — Vercel | ✅ |
| 1.2b — Dev local | ✅ |
| 1.2c — TLS | ✅ |
| 1.3 — Realtime centralizado | ✅ |
| 1.3b — Motor ETA topológico | ✅ |
| 1.3c — Integración realtime + ETA | ✅ |
| 1.4 — Consolidación/validación realtime | 🔵 |
| 2 — Routing correcto | ⬜ |
| 3 — Sincronización avanzada Avanza | ⬜ |
| 4 — Rendimiento | ⬜ |
| 5 — UX / Accesibilidad / Producto | ⬜ |
| 6 — PWA / Producto final | ⬜ |

---

# ESTADO INICIAL PARA EL SIGUIENTE AGENTE

Antes de implementar cualquier cosa:

1. Leer este `ROADMAP.md`.
2. Inspeccionar el repositorio completo.
3. Revisar `package.json` y scripts disponibles.
4. Revisar tests existentes.
5. Revisar la implementación realtime.
6. Revisar `api/eta.js`.
7. Revisar `api/devProxy.js`.
8. Revisar `LiveDataContext`.
9. Revisar `routePlanner.js`.
10. Revisar `avanzaSchedules.js`.
11. Revisar `topologyMap.js`.
12. Revisar la implementación de `effectiveTopology`.
13. Revisar la resolución de `tripIdx`.
14. Confirmar los casos L1/L2/L3, viajes cortos, prolongaciones y
    circulares.
15. Ejecutar la batería de tests.
16. Ejecutar lint.
17. Ejecutar build.
18. Comparar los resultados con el estado declarado en este documento.

**No comenzar directamente la implementación de Fase 1.4.**

Primero producir una auditoría del estado actual y determinar exactamente
qué queda pendiente.

---

# REGLA FINAL

El objetivo del roadmap no es hacer más código.

El objetivo es que cada fase deje el sistema en un estado:

```text
más correcto
más fiable
más verificable
```

y que las decisiones difíciles ya resueltas no vuelvan a romperse en
fases posteriores.
# TUSoria — Final Audit

Fecha de Auditoría: 19 de Agosto de 2026  
Entorno de Ejecución: Windows / Node.js / Vitest / Vite / Oxlint  
Rama Auditada: `phase-0-foundations` (Commit: `4345dd6`)

---

## 1. Executive Summary

**Veredicto:** `READY FOR RELEASE`

Tras una auditoría exhaustiva e independiente del repositorio, se constata que todas las fases y principios arquitectónicos definidos en el [ROADMAP.md](file:///e:/SoriaBus/ROADMAP.md) se encuentran **realmente implementados, testeados (94/94 tests pasando) y validados mediante compilación y análisis estático sin errores**.

- **Calidad de Código y Tests:** 94 tests unitarios e integrados pasando en 18 archivos de test (superando la línea base de 80 tests).
- **Linter:** 0 errores detectados con `oxlint`.
- **Rendimiento:** Bundle principal optimizado con *vendor chunking* a **261.50 kB** (49.43 kB gzip), build de producción generado en **318 ms**.
- **Seguridad TLS:** Mantenimiento de `rejectUnauthorized: true` con certificado intermedio Sectigo y proxy serverless seguro.
- **Motor Realtime:** Jerarquía completa `REAL` → `INTERPOLATED` → `GPS` → `SCHEDULED` respaldada por `LiveDataContext` con *Promise Locking* y caché TTL (15 s).
- **Routing Topológico:** Control direccional estricto, paradas circulares (*wrap-around* en C y EX) y sincronización de transbordos con margen mínimo de 2 minutos.

---

## 2. Roadmap Verification

| Fase | Declarada | Verificada | Resultado | Evidencia |
| :--- | :--- | :--- | :---: | :--- |
| **0 — Foundations** | COMPLETADA | Estructura PWA, mapa, paradas, geometrías, horarios y componentes base. | `PASS` | `TEST-VERIFIED` + `CODE-VERIFIED` ([tests/transitNetwork.test.js](file:///e:/SoriaBus/tests/transitNetwork.test.js)) |
| **1.1 — API ETA Segura** | COMPLETADA | Proxy `/api/eta` con validación regex de `stopId`, control de errores y contrato JSON consistente. | `PASS` | `TEST-VERIFIED` ([tests/apiEta.test.js](file:///e:/SoriaBus/tests/apiEta.test.js)) |
| **1.2 — Despliegue & TLS** | COMPLETADA | Adaptador dev en Vite (`api/devProxy.js`) y agente HTTPS con certificado Sectigo (`rejectUnauthorized: true`). | `PASS` | `TEST-VERIFIED` ([tests/tlsFix.test.js](file:///e:/SoriaBus/tests/tlsFix.test.js), [tests/viteAdapter.test.js](file:///e:/SoriaBus/tests/viteAdapter.test.js)) |
| **1.3 — LiveDataContext** | COMPLETADA | Sondeo centralizado sobre 7 hubs con *backoff* exponencial (8s–60s), frescura (<25s fresh, 25-120s stale, >120s dead). | `PASS` | `TEST-VERIFIED` + `CODE-VERIFIED` ([tests/liveDataContext.test.js](file:///e:/SoriaBus/tests/liveDataContext.test.js)) |
| **1.3b — Motor ETA 2.0** | COMPLETADA | Topología efectiva, resolución de `tripIdx`, prolongaciones de L2, paradas repetidas y anclas progresivas. | `PASS` | `TEST-VERIFIED` ([tests/effectiveTopology.test.js](file:///e:/SoriaBus/tests/effectiveTopology.test.js), [tests/testEmpirico.test.js](file:///e:/SoriaBus/tests/testEmpirico.test.js)) |
| **1.3c — Integración Realtime** | COMPLETADA | Jerarquía de 4 niveles (`REAL` → `INTERPOLATED` → `GPS` → `SCHEDULED`), Promise Locking y caché TTL de 15s. | `PASS` | `TEST-VERIFIED` ([tests/realtimeIntegration.test.js](file:///e:/SoriaBus/tests/realtimeIntegration.test.js), [tests/progressiveEta.test.js](file:///e:/SoriaBus/tests/progressiveEta.test.js)) |
| **1.4 — Consolidación Realtime**| COMPLETADA | Erradicación de cascadas de hubs, ausencia de polling duplicado, consumo unificado en modal y mapa. | `PASS` | `CODE-VERIFIED` + `TEST-VERIFIED` ([tests/modalLogic.test.js](file:///e:/SoriaBus/tests/modalLogic.test.js)) |
| **2 — Routing Correcto** | COMPLETADA | Motor direccional `isTopologicallyReachable`, transbordos con buffer $\ge 2\text{ min}$, e inyección de `getStopETAs`. | `PASS` | `TEST-VERIFIED` ([tests/routePlannerDirectional.test.js](file:///e:/SoriaBus/tests/routePlannerDirectional.test.js)) |
| **3 — Sincronización Avanza** | COMPLETADA | Validación de esquemas `tripTimes`/`colTypes`, script `npm run sync` y correspondencia de `TOPOLOGY_MAP`. | `PASS` | `TEST-VERIFIED` ([tests/dataValidation.test.js](file:///e:/SoriaBus/tests/dataValidation.test.js), [scripts/syncAvanzaData.mjs](file:///e:/SoriaBus/scripts/syncAvanzaData.mjs)) |
| **4 — Rendimiento** | COMPLETADA | Vendor chunking en Rollup/Vite (`vendor-react`, `vendor-leaflet`), bundle reducido a 261 kB, build ~300ms. | `PASS` | `MEASURED` (`npm run build`) |
| **5 — UX / Accesibilidad** | COMPLETADA | Roles ARIA (`tablist`, `tab`, `aria-selected`), labels accesibles en navegación y manejo limpio de geolocalización. | `PASS` | `CODE-VERIFIED` ([src/components/NavigationTabs.jsx](file:///e:/SoriaBus/src/components/NavigationTabs.jsx)) |
| **6 — PWA / Producto Final** | COMPLETADA | Service Worker con precache de recursos estáticos, manifest responsive (192, 512, maskable) y modo standalone. | `PASS` | `CODE-VERIFIED` ([vite.config.js](file:///e:/SoriaBus/vite.config.js), [index.html](file:///e:/SoriaBus/index.html)) |

---

## 3. Automated Verification

### Tests
- **Comando:** `npm test` (`vitest run`)
- **Total Tests:** 94
- **Tests Pasando:** 94
- **Tests Fallando:** 0
- **Tests Skipped:** 0
- **Archivos de Test:** 18
- **Duración de la Suite:** 1.30 segundos
- **Línea base cumplida:** Sí (94 $\ge$ 80).

### Linter
- **Comando:** `npm run lint` (`oxlint`)
- **Errores:** 0
- **Warnings:** 11 (avisos menores de variables no utilizadas en tests y anotaciones de Fast Refresh en contexto).

### Compilación (Build)
- **Comando:** `npm run build` (`vite build`)
- **Resultado:** Exit code 0 (completado con éxito en 318 ms).
- **Advertencias de tamaño de Vite:** Ninguna (todos los chunks están por debajo del límite de 500 kB).

### Verificación de Datos (`npm run sync`)
- **Comando:** `node scripts/syncAvanzaData.mjs`
- **Resultado:** Todos los datasets (`soriaLinesData.js`, `soriaLines.js`, `avanzaSchedules.js`, `camaretasSchedule.js`, `topologyMap.js`, `provisionalStops.js`) comprobados y consistentes.

---

## 4. Performance

### Métricas Medidas (`MEASURED`)
- **Bundle Principal (`dist/assets/index-QTOGm1Uv.js`):** 261.50 kB (Gzip: 49.43 kB).
- **Chunk Vendor React (`dist/assets/vendor-react-DSgEdzcY.js`):** 189.54 kB (Gzip: 59.60 kB).
- **Chunk Vendor Leaflet (`dist/assets/vendor-leaflet-CokZeKQT.js`):** 148.81 kB (Gzip: 43.39 kB).
- **CSS Total:** 29.02 kB (Gzip: 9.76 kB entre `index.css` y `vendor-leaflet.css`).
- **Tiempo de compilación:** 318 ms.

### Observaciones de Código (`CODE-VERIFIED`)
- **Renders del Mapa:** La actualización de posiciones GPS de autobuses no recrea las capas del mapa; muta coordenadas de marcadores existentes mediante `busMarkersMapRef`.
- **Polling:** Polling serializado con `setTimeout` recursivo (sin acumulación de peticiones en vuelo).
- **Animación 60 FPS:** `UNVERIFIED` instrumentalmente en runtime, pero `CODE-VERIFIED` en cuanto a la lógica de interpolación lineal por temporizador desacoplado de la red.

---

## 5. Realtime Audit

La cadena de tiempo real ha sido verificada código por código:
1. **Avanza Endpoint:** Se accede a través de `/api/eta?stopId=...`.
2. **API Proxy:** Valida el `stopId`, gestiona la caché de servidor (20 s TTL), maneja JSON inválido y respuestas vacías sin crashear, y aplica agente HTTPS con el certificado intermedio Sectigo.
3. **LiveDataContext:** Realiza sondeo periódico exclusivo sobre los 7 hubs maestros (`HUB_STOP_IDS`) cada 8–60 s. Expone `getStopETAs(stopId)` con *Promise Locking* y caché local de 15 segundos.
4. **Motor ETA (`src/services/avanzaApi.js`):**
   - **Nivel 1 (REAL):** Comprueba `/api/eta?stopId=...`. Si hay estimación real, la retorna inmediatamente.
   - **Nivel 2 (INTERPOLATED):** Búsqueda progresiva de anclas hacia paradas previas respetando la `effectiveTopology` de la expedición activa y la lista de paradas excluidas (`BROKEN_STOPS_BLACKLIST`). Aplica timeout global de 3.5 s.
   - **Nivel 3 (GPS):** Si no hay anclas pero existe posición de autobuses en `liveBuses`, proyecta sobre el trazado topológico a velocidad comercial.
   - **Nivel 4 (SCHEDULED):** Si no hay datos en vivo, recurre a la matriz de horarios oficiales.
5. **UI (Modal / Mapa / Planner):** Todos consumen `getStopETAs` unificadamente sin realizar peticiones redundantes.

---

## 6. Routing Audit

- **Topología y Dirección:** `isTopologicallyReachable` verifica que en líneas lineales (`L1`, `L2`, `L3`, `L4`, `L4E`) el índice de origen sea estrictamente menor que el de destino (`fromIdx < toIdx`). En líneas circulares (`C`, `EX`), permite el *wrap-around* (`fromIdx > toIdx`). En la línea `LC` (Camaretas), valida el orden secuencial en ambos sentidos.
- **Tiempos de Tránsito:** `calculateTransitTimeMin` computa la diferencia de minutos de la matriz de horarios oficial de Avanza (`AVANZA_FULL_SCHEDULES`), con fallback basado en la distancia topológica acumulada a 250 m/min.
- **Transbordos Sincronizados:** Para rutas con 1 transbordo en hubs, el planificador calcula la llegada de la primera línea (`hubArrivalMin`) y exige `earliestBoard2Min = hubArrivalMin + 2`, garantizando que el segundo autobús parta al menos 2 minutos después de la llegada del primero.
- **Desacoplamiento:** `routePlanner.js` es un módulo JavaScript puro, sin dependencias de React, recibiendo `getStopETAs` por inyección.

---

## 7. PWA Audit

- **Manifest:** Configurado en `vite.config.js` con nombre `TUSoria`, `display: standalone`, `theme_color: #2563eb` y referencias a iconos 192x192 y 512x512 (con propósito `maskable`).
- **Iconos Reales:** Existen físicamente en `public/` (`pwa-192x192.png`, `pwa-512x512.png`, `apple-touch-icon.png`, `favicon.svg`, `favicon.png`).
- **Service Worker:** Generado automáticamente por Workbox (`generateSW`), precacheando 18 recursos (HTML, CSS, JS, imágenes) con `cleanupOutdatedCaches: true`, `skipWaiting: true` y `clientsClaim: true`.
- **Alcance Offline:** `CODE-VERIFIED` para el shell de la aplicación y datos estáticos de líneas/horarios. La funcionalidad realtime requiere conectividad de red por naturaleza.
- **Mecanismo de Recuperación:** `index.html` contiene script de auto-recuperación que desregistra el Service Worker y vacía la caché si se detecta fallo de carga de assets.

---

## 8. Accessibility Audit

- **Navegación:** `NavigationTabs.jsx` implementa `role="tablist"` y `role="tab"` con `aria-selected={activeTab === tab.id}` y `aria-label` descriptivos. El badge de alertas incluye `aria-label="Nuevos avisos"`.
- **Buscador:** `SearchBar.jsx` dispone de etiquetas semánticas, placeholders descriptivos y manejo de errores con avisos en pantalla para permisos GPS.
- **Validación Automatizada con Lector de Pantalla:** `UNVERIFIED` (requiere auditoría manual con NVDA/VoiceOver/Lighthouse en navegador).

---

## 9. Security Audit

- **Secretos / Claves Expuestas:** Ninguno detectado. No se utilizan API keys sensibles en el cliente.
- **Validación TLS:** `api/eta.js` mantiene `rejectUnauthorized: true` usando la cadena con el certificado intermedio Sectigo en `certs/sectigo-ov-r36.pem`.
- **Inyección / Saneamiento:** El proxy valida `stopId` con expresión regular `/^[a-zA-Z0-9_]+$/`, rechazando cualquier intento de inyección de scripts o caracteres especiales con HTTP 400.
- **CORS:** Cabeceras `Access-Control-Allow-Origin: *` configuradas para permitir consumo seguro en web y entornos serverless.

---

## 10. Git / Release State

- **Rama actual:** `phase-0-foundations`
- **Último commit:** `4345dd6 docs(roadmap): FASE 6 completada y ROADMAP completado al 100%`
- **Working tree:** Limpio (`nothing to commit, working tree clean`).
- **Sincronización con origin:** `Your branch is up to date with 'origin/phase-0-foundations'`.
- **Aptitud para Release:** La rama `phase-0-foundations` contiene el historial completo y lineal de las fases 0 a 6. Está lista para ser fusionada mediante Pull Request hacia la rama `main` de producción.

---

## 11. Findings

### CRITICAL (Bloquea release)
*Ninguno.*

### HIGH (Debe solucionarse antes de release salvo decisión explícita)
*Ninguno.*

### MEDIUM (No bloquea release pero debería registrarse)
1. **Warnings menores del Linter en Tests:** `oxlint` señala variables importadas no usadas en algunos archivos de prueba (`tests/tlsFix.test.js`, `tests/modalLogic.test.js`, etc.). No afectan a producción ni a la ejecución de los tests.
2. **Aviso Fast Refresh en LiveDataContext:** `useLiveData()` se exporta desde el mismo archivo que `LiveDataProvider`. Es el patrón estándar de Context en React, pero produce un warning informativo de HMR.

### LOW (Mejoras futuras)
1. **Auditoría de Accesibilidad Manual:** Ejecutar Lighthouse Accessibility / axe-core en un navegador real para validar contraste y ratios de color exactos en el mapa.

### INFORMATIONAL
1. **Comportamiento Offline:** Como es propio de aplicaciones de transporte en tiempo real, el modo offline permite consultar paradas, líneas, mapas estáticos y horarios programados, pero las ETAs en vivo requieren conexión de datos.

---

## 12. Final Verdict

# `READY FOR RELEASE`

**Justificación:**
El proyecto TUSoria ha cumplido todos los requerimientos funcionales, arquitectónicos y de calidad establecidos en el [ROADMAP.md](file:///e:/SoriaBus/ROADMAP.md). La suite completa de 94 tests pasa sin errores, el linter no reporta errores de código, el bundle de producción está optimizado y no sobrepasa ningún límite de tamaño, la seguridad TLS está preservada rigurosamente, y la integración en tiempo real opera de manera jerárquica y estable.

# 🚌 TUSoria — Transporte Urbano de Soria en Tiempo Real

[![Vite](https://img.shields.io/badge/Vite-8.2+-646CFF?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-18+-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev/)
[![Vitest](https://img.shields.io/badge/Tests-102%20passing-brightgreen?style=flat&logo=vitest&logoColor=white)](https://vitest.dev/)
[![PWA](https://img.shields.io/badge/PWA-Installable-blueviolet?style=flat&logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**TUSoria** es una aplicación web progresiva (PWA) de alto rendimiento, diseñada para consultar en tiempo real el transporte urbano de la ciudad de Soria (Avanza Soria) y la conexión metropolitana con Golmayo / Las Camaretas.

Permite ver la ubicación estimada de los autobuses, tiempos de llegada en cada parada, consultar horarios oficiales completos y planificar rutas punto a punto con cálculo de salidas y llegadas programadas.

---

## ✨ Características Principales

### 🗺️ 1. Mapa Interactivo en Vivo
- Visualización de la red completa de paradas y trazados oficiales.
- Renderizado de alto rendimiento a 60 FPS con aceleración por hardware (`preferCanvas: true`, GPU compositing).
- Flechas direccionales dinámicas y visualización de rutas con un solo clic.

### ⏱️ 2. Motor de Tiempos de Llegada Híbrido (SAE 2.0)
- **Tiempo real SAE:** Conexión con los sistemas de posicionamiento GPS de los autobuses de Avanza.
- **Interpolación Topológica Progresiva:** Si una parada no reporta señal GPS directa, el algoritmo busca la parada ancla anterior en el grafo de la línea y calcula el tiempo exacto de llegada considerando la velocidad comercial media.
- **Fallback a Horarios Oficiales:** Fuera del horario de emisión de balizas, calcula la próxima salida con base en la matriz horaria oficial.

### 🧭 3. Planificador Inteligente de Rutas
- **`⏱️ Salir ahora`**: Busca las mejores opciones con el tráfico y estado actual de los autobuses.
- **`🕐 Salir a las...`**: Planifica trayectos a futuro especificando hora y día (`Hoy` / `Mañana`).
- **`🏁 Llegar a las...`** *(Backward Scheduling)*: Permite fijar la hora a la que necesitas estar en tu destino (ej. Hospital o Estación) y calcula hacia atrás a qué hora exacta debes salir de casa.
- **Transbordos optimizados:** Detección de enlaces en paradas hub (Mariano Granados, Hospital, Estación de Autobuses, etc.) con margen de seguridad mínimo de 2 minutos.

### 📅 4. Horarios Oficiales Completos
- Base de datos exhaustiva de horarios vigentes de Avanza Soria (marzo 2025).
- Tabla interactiva desglosada por paradas y expediciones estándar y con prolongaciones (`*Calaverón` y `*Polígono`).

### 📱 5. PWA (Progressive Web App) Offline-Ready
- Totalmente instalable en iOS, Android y escritorio.
- Iconos adaptativos W3C con zona segura *Maskable* (192x192 y 512x512).
- Service Worker con caché inteligente (Workbox).

---

## 🚏 Líneas de Autobús Cubiertas

| Línea | Nombre / Recorrido | Frecuencia Laborables | Frecuencia Sábados | Domingos / Festivos |
|:---:|:---|:---:|:---:|:---:|
| **L1** | Centro – Hospitales (vía Pajaritos) | Cada 20 min (07:30 - 22:30) | Cada 30 min (08:30 - 22:00) | *Ver Línea Circular (C)* |
| **L2** | Centro – Polígono – Estación Autobuses | Cada 20 min (07:40 - 22:40) | Cada 30 min (08:40 - 21:40) | *Ver Línea Circular (C)* |
| **L3** | Centro – Hospitales (vía Royales) | Cada 20 min (07:35 - 22:15) | Cada 30 min (08:45 - 21:45) | *Sin servicio* |
| **L4** | Centro – Hospitales – Estación | Cada 30 min (07:45 - 21:45) | Cada 30 min (09:15 - 21:15) | *Sin servicio* |
| **L4E** | El Salvador – Barrio de Las Casas | Turnos (07:50, 13:50, 19:50) | Turnos puntuales | *Sin servicio* |
| **C** | **Línea Circular** (Festivos) | *Sin servicio (L1-L4 activas)* | *Sin servicio* | Cada 30 min (09:00 - 21:30) |
| **EX** | Exprés Polígono Industrial Valcorba | Turnos laborales (06:45, 07:45, 14:45) | *Sin servicio* | *Sin servicio* |
| **LC** | Soria (Duques de Soria) – CC Camaretas (Golmayo) | Cada 30 min (08:00 - 22:00) | Cada 30-45 min (08:00 - 22:30) | Turno tarde (16:00 - 22:00) |

---

## 🛠️ Estructura del Proyecto

```text
SoriaBus/
├── api/
│   └── eta.js                  # Proxy Serverless para la API de Avanza (TLS y fallback)
├── public/
│   ├── favicon.svg             # Favicon vectorial
│   ├── pwa-192x192.png         # Iconos PWA estándar
│   ├── pwa-512x512.png
│   ├── pwa-maskable-192x192.png# Iconos PWA con safe-zone W3C
│   └── pwa-maskable-512x512.png
├── src/
│   ├── components/
│   │   ├── MapView.jsx         # Mapa interactivo Leaflet
│   │   ├── SearchBar.jsx       # Búsqueda de paradas, lugares y selector de horas
│   │   ├── RouteResultsDrawer.jsx # Visualizador de itinerarios paso a paso
│   │   ├── StopDetailModal.jsx # Tiempos en tiempo real y horarios por parada
│   │   ├── LinesView.jsx       # Selector y tablas completas de horarios
│   │   └── AlertsView.jsx      # Avisos del servicio e incidencias
│   ├── context/
│   │   └── LiveDataContext.jsx # Estado global y suscripciones en tiempo real
│   ├── data/
│   │   ├── soriaLines.js       # Metadatos, colores y frecuencias de líneas
│   │   ├── soriaLinesData.js   # Paradas oficiales con coordenadas GPS
│   │   ├── avanzaSchedules.js  # Matriz horaria oficial Avanza
│   │   ├── camaretasSchedule.js# Horarios línea Camaretas
│   │   └── topologyMap.js      # Grafo y topología de secuencias de paradas
│   ├── services/
│   │   ├── avanzaApi.js        # Cliente API de tiempos de espera
│   │   ├── etaEngine.js        # Motor de interpolación y cálculo de ETAs
│   │   └── routePlanner.js     # Motor de búsqueda de rutas directas y transbordos
│   ├── utils/
│   │   ├── geoUtils.js         # Cálculos de distancia y geocodificación
│   │   └── stopMatcher.js      # Normalización y casamiento de nombres de parada
│   ├── App.jsx                 # Componente raíz
│   ├── index.css               # Estilos globales y temas
│   └── main.jsx                # Punto de entrada Vite
├── tests/                      # Suite de tests unitarios y de integración (Vitest)
├── vite.config.js              # Configuración de Vite y PWA Manifest
└── package.json
```

---

## 🚀 Puesta en Marcha en Local

### Requisitos previos
- Node.js 18+ (recomendado Node.js 20 o 22)
- npm o pnpm

### 1. Clonar el repositorio
```bash
git clone https://github.com/TheSorian/TUSoria.git
cd TUSoria
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Ejecutar en modo desarrollo
```bash
npm run dev
```
La aplicación estará disponible en `http://localhost:5173`. En modo desarrollo local, el servidor de Vite actúa como proxy hacia `/api/eta` para evitar bloqueos por CORS.

---

## 🧪 Pruebas y Validación

El proyecto cuenta con una cobertura integral de pruebas automáticas con **Vitest**:

```bash
# Ejecutar toda la suite de tests
npm test

# Ejecutar el linter (Oxlint)
npm run lint

# Compilar para producción
npm run build
```

---

## 📦 Despliegue

La aplicación está lista para ser desplegada en **Vercel**, **Netlify** o cualquier plataforma compatible con SPA y Serverless Functions:

- En **Vercel**, la función serverless en `api/eta.js` se configura automáticamente para gestionar las peticiones a la API del SAE.
- Si se empaqueta con **Capacitor** (iOS/Android), la variable `VITE_API_BASE_URL` puede apuntar al endpoint de producción.

---

## 📄 Licencia

Este proyecto está distribuido bajo la licencia **MIT**. Consulta el archivo `LICENSE` para más detalles.

---

<p align="center">Desarrollado con ❤️ para los ciudadanos y visitantes de <b>Soria</b>.</p>

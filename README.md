# 🚌 TUSoria — Transporte Urbano de Soria en Tiempo Real

[![Vite](https://img.shields.io/badge/Vite-8.2+-646CFF?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-18+-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev/)
[![Vitest](https://img.shields.io/badge/Tests-102%20passing-brightgreen?style=flat&logo=vitest&logoColor=white)](https://vitest.dev/)
[![PWA](https://img.shields.io/badge/PWA-Installable-blueviolet?style=flat&logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)
[![Android APK](https://img.shields.io/badge/Android-APK%20Disponible-3DDC84?style=flat&logo=android&logoColor=white)](https://github.com/TheSorian/TUSoria/releases/tag/latest-apk)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**TUSoria** es una aplicación web progresiva (PWA) y app nativa Android de alto rendimiento, diseñada para consultar en tiempo real el transporte urbano de la ciudad de Soria (Avanza Soria) y la conexión metropolitana con Golmayo / Las Camaretas.

Permite ver la ubicación estimada de los autobuses, tiempos de llegada en cada parada, consultar horarios oficiales completos y planificar rutas punto a punto con cálculo de salidas y llegadas programadas.

---

## 📱 Descarga de la App Nativa (APK Android)

Además de usar TUSoria desde el navegador como **PWA instalable**, dispones de la aplicación nativa para **Android** compilada mediante Capacitor.

### 📥 Descarga Directa
Puedes descargar la versión más reciente lista para instalar desde GitHub:

👉 **[Descargar TUSoria APK (Última versión)](https://github.com/TheSorian/TUSoria/releases/tag/latest-apk)**

### 📲 Cómo instalar en tu móvil:
1. Pulsa en el enlace superior y descarga el archivo `.apk` en tu dispositivo Android.
2. Abre la descarga. Si tu móvil lo solicita, permite *"Instalar aplicaciones de fuentes desconocidas"* para tu navegador o gestor de descargas.
3. Pulsa **Instalar**.
4. ¡Listo! Disfruta de la app con apertura instantánea, pantalla completa y soporte de geolocalización GPS nativa.

> **Compilación Automática:** El repositorio incluye un flujo de trabajo continuo en **GitHub Actions** (`.github/workflows/build-apk.yml`) que genera y actualiza automáticamente el APK con cada actualización en la rama principal `main`.

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
- Base de datos exhaustiva de horarios oficiales vigentes de Avanza Soria (marzo 2025).
- Tabla interactiva desglosada por paradas y expediciones estándar y con prolongaciones (`*Calaverón` y `*Polígono`).

### 📱 5. PWA (Progressive Web App) Offline-Ready
- Totalmente instalable en iOS, Android y escritorio.
- Iconos adaptativos W3C con zona segura *Maskable* (192x192 y 512x512).
- Service Worker con caché inteligente (Workbox).

---

## 🚏 Red de Líneas y Recorridos

| Línea | Denominación Oficial | Recorrido / Terminales | Tipo de Servicio |
|:---:|:---|:---|:---:|
| **L1** | Centro – Hospitales (vía Pajaritos) | Plaza Mariano Granados ➔ Campus Los Pajaritos ➔ Hospital Santa Bárbara (*Calaverón) | Diario (L-S) |
| **L2** | Centro – Polígono – Estación Autobuses | El Salvador ➔ Estación Autobuses ➔ Santa Bárbara (*Polígono Las Casas) | Diario (L-S) |
| **L3** | Centro – Hospitales (vía Royales) | Plaza Mariano Granados ➔ Los Royales ➔ Hospital Santa Bárbara (*Calaverón) | Diario (L-S) |
| **L4** | Centro – Hospitales – Estación | Plaza Mariano Granados ➔ Hospital Santa Bárbara ➔ Estación de Autobuses | Diario (L-S) |
| **L4E** | El Salvador – Barrio de Las Casas | El Salvador ➔ Polígono Industrial ➔ Barrio de Las Casas | Expediciones de turno (L-V) |
| **C** | **Línea Circular** (Festivos) | El Salvador ➔ Barriada ➔ Royales ➔ Granados ➔ Calaverón ➔ Hospital ➔ Estación | Domingos y Festivos |
| **EX** | Exprés Polígono Industrial Valcorba | Plaza Mariano Granados ➔ Polígono Valcorba / Las Casas | Turnos laborales (06:45, 07:45, 14:45) |
| **LC** | Soria – CC Camaretas (Golmayo) | Av. Duques de Soria / Estación ➔ Centro Cívico Las Camaretas | Diario (Lunes a Domingo) |

> ℹ️ *Los horarios exactos de paso para cada parada pueden consultarse interactivamente desde la sección **Líneas y Horarios** de la aplicación.*

---

## 🛠️ Estructura del Proyecto

```text
SoriaBus/
├── .github/
│   └── workflows/
│       └── build-apk.yml       # Compilación y publicación automática del APK Android
├── android/                    # Proyecto nativo Android (Capacitor)
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
│   │   ├── soriaLines.js       # Metadatos y colores de líneas
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
├── capacitor.config.json       # Configuración Capacitor nativo
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

- **Web / PWA:** Listo para ser desplegado en **Vercel** o **Netlify**. La función serverless en `api/eta.js` se configura automáticamente para gestionar las peticiones a la API del SAE.
- **Android Nativo:** El proyecto Capacitor sincroniza la carpeta `dist` con el proyecto Android:
  ```bash
  npm run build
  npx cap sync android
  ```

---

## 📄 Licencia

Este proyecto está distribuido bajo la licencia **MIT**. Consulta el archivo `LICENSE` para más detalles.

---

<p align="center">Desarrollado con ❤️ para los ciudadanos y visitantes de <b>Soria</b>.</p>

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { SORIA_ALL_STOPS as DEFAULT_STOPS, REAL_LINE_POLYLINES } from '../data/soriaLinesData';

const LINES = ['L1', 'L2', 'L3', 'L4', 'L4E', 'C', 'EX', 'LC'];

const LINE_COLORS = {
  'L1': '#1a4b8c',
  'L2': '#dc2626',
  'L3': '#0891b2',
  'L4': '#059669',
  'L4E': '#059669',
  'C': '#7c3aed',
  'EX': '#d97706',
  'LC': '#d4af37'
};

const CALAVERON_STOP_IDS = ['11', '14'];
const POLIGONO_STOP_IDS = ['79', '77', '75', '74', '76', '78', '80', '23'];

function findClosestPointIndex(coords, point) {
  if (!coords || !point) return 0;
  let minD = Infinity;
  let minIdx = 0;
  for (let i = 0; i < coords.length; i++) {
    const lat = parseFloat(coords[i][0]);
    const lng = parseFloat(coords[i][1]);
    const d = (lat - point[0]) ** 2 + (lng - point[1]) ** 2;
    if (d < minD) {
      minD = d;
      minIdx = i;
    }
  }
  return minIdx;
}

function getTrimmedLegPolyline(fullCoordsArrays, boardCoords, alightCoords) {
  if (!fullCoordsArrays || fullCoordsArrays.length === 0) return [];
  if (!boardCoords || !alightCoords) return fullCoordsArrays[0] || [];

  let bestSub = fullCoordsArrays[0];
  let minD = Infinity;
  fullCoordsArrays.forEach(arr => {
    const idx = findClosestPointIndex(arr, boardCoords);
    const lat = parseFloat(arr[idx][0]);
    const lng = parseFloat(arr[idx][1]);
    const d = (lat - boardCoords[0])**2 + (lng - boardCoords[1])**2;
    if (d < minD) {
      minD = d;
      bestSub = arr;
    }
  });

  const startIdx = findClosestPointIndex(bestSub, boardCoords);
  const endIdx = findClosestPointIndex(bestSub, alightCoords);

  if (startIdx <= endIdx) {
    const seg = bestSub.slice(startIdx, endIdx + 1);
    return [boardCoords, ...seg, alightCoords];
  } else {
    const seg = bestSub.slice(endIdx, startIdx + 1).reverse();
    return [boardCoords, ...seg, alightCoords];
  }
}

function isExtensionPoint(lat, lng, lineCode, polyIdx = 0) {
  if (lineCode === 'L2') {
    // Only prolongation sub-polyline (polyIdx === 1) north of Calle N / Calle J
    if (polyIdx !== 1) return false;
    return lat > 41.7725 || (lat > 41.7720 && lng < -2.4885);
  }
  if (lineCode === 'L1' || lineCode === 'L3') {
    // Calaverón detour loop (Juan Antonio Simón, Morales Contreras, Santa Clara, Rabanera)
    return lat >= 41.7585 && lat <= 41.7626 && lng >= -2.4682 && lng <= -2.4635;
  }
  return false;
}

function renderSegmentedPolyline(coords, lineCode, color, isRouteActive, layerGroup, polyIdx = 0) {
  if (!coords || coords.length === 0) return;

  let currentSegment = [coords[0]];
  let currentIsExt = isExtensionPoint(parseFloat(coords[0][0]), parseFloat(coords[0][1]), lineCode, polyIdx);

  for (let i = 1; i < coords.length; i++) {
    const pt = coords[i];
    const isExt = isExtensionPoint(parseFloat(pt[0]), parseFloat(pt[1]), lineCode, polyIdx);

    if (isExt === currentIsExt) {
      currentSegment.push(pt);
    } else {
      currentSegment.push(pt);
      if (currentIsExt) {
        L.polyline(currentSegment, {
          color: color, // Uses line's own color!
          weight: isRouteActive ? 4 : 5,
          dashArray: '8, 8',
          opacity: isRouteActive ? 0.5 : 0.95
        }).addTo(layerGroup);
      } else {
        L.polyline(currentSegment, {
          color: color,
          weight: isRouteActive ? 2 : 4,
          opacity: isRouteActive ? 0.2 : 0.85
        }).addTo(layerGroup);
      }
      currentSegment = [pt];
      currentIsExt = isExt;
    }
  }

  if (currentSegment.length > 1) {
    if (currentIsExt) {
      L.polyline(currentSegment, {
        color: color, // Uses line's own color!
        weight: isRouteActive ? 4 : 5,
        dashArray: '8, 8',
        opacity: isRouteActive ? 0.5 : 0.95
      }).addTo(layerGroup);
    } else {
      L.polyline(currentSegment, {
        color: color,
        weight: isRouteActive ? 2 : 4,
        opacity: isRouteActive ? 0.2 : 0.85
      }).addTo(layerGroup);
    }
  }

  // Render direction arrows along the polyline
  const arrowStep = Math.max(15, Math.floor(coords.length / 7));
  for (let i = arrowStep; i < coords.length - 5; i += arrowStep) {
    const p1 = coords[i - 2];
    const p2 = coords[i + 2] || coords[i + 1];
    if (p1 && p2) {
      const dy = parseFloat(p2[0]) - parseFloat(p1[0]);
      const dx = parseFloat(p2[1]) - parseFloat(p1[1]);
      if (dy * dy + dx * dx > 0.0000001) {
        const angle = Math.atan2(dx, dy) * (180 / Math.PI);
        const arrowIcon = L.divIcon({
          className: 'polyline-arrow-marker',
          html: `<div style="transform: rotate(${angle.toFixed(1)}deg); width: 14px; height: 14px; display: flex; align-items: center; justify-content: center; pointer-events: none; opacity: ${isRouteActive ? 0.5 : 0.9};">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="${color}" stroke="#ffffff" stroke-width="1.5" style="filter: drop-shadow(0 1px 2px rgba(0,0,0,0.6));">
              <path d="M12 2L2 22l10-4 10 4z"/>
            </svg>
          </div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7]
        });
        L.marker([parseFloat(coords[i][0]), parseFloat(coords[i][1])], {
          icon: arrowIcon,
          interactive: false
        }).addTo(layerGroup);
      }
    }
  }
}


export default function MapView({ onSelectStop, activeRoute, userLocation }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef(null);
  const [selectedLineFilter, setSelectedLineFilter] = useState(null);
  
  // Interactive Stop Edit Mode State
  const [isEditMode, setIsEditMode] = useState(false);

  // Initialize stopsData from LocalStorage if available so user edits survive refreshes!
  const [stopsData, setStopsData] = useState(() => {
    try {
      const saved = localStorage.getItem('soria_custom_stops');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge saved coordinates with default stops
        return DEFAULT_STOPS.map(dStop => {
          const savedStop = parsed.find(s => s.id === dStop.id);
          return savedStop ? { ...dStop, lat: savedStop.lat, lng: savedStop.lng } : dStop;
        });
      }
    } catch (e) {
      console.warn("Could not load custom stops from localStorage", e);
    }
    return DEFAULT_STOPS;
  });

  const [lastDraggedStop, setLastDraggedStop] = useState(null);

  // Save custom coordinates to localStorage whenever stopsData changes
  const updateStopPosition = (stopId, newLat, newLng) => {
    setStopsData(prevStops => {
      const updated = prevStops.map(s => s.id === stopId ? { ...s, lat: newLat, lng: newLng } : s);
      try {
        localStorage.setItem('soria_custom_stops', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  useEffect(() => {
    if (!mapRef.current && mapContainerRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: false
      }).setView([41.7638, -2.4687], 14);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap &copy; CartoCiudad IGN'
      }).addTo(map);

      const layerGroup = L.layerGroup().addTo(map);
      layersRef.current = layerGroup;
      mapRef.current = map;

      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    }
    
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !layersRef.current) return;
    
    const map = mapRef.current;
    const layerGroup = layersRef.current;
    layerGroup.clearLayers();

    const boundsPoints = [];
    
    // 1. Draw User GPS Location Marker if available
    if (userLocation && userLocation.lat && userLocation.lng) {
      boundsPoints.push([userLocation.lat, userLocation.lng]);
      const userIcon = L.divIcon({
        className: 'user-gps-marker',
        html: `
          <div style="position: relative; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; width: 32px; height: 32px; border-radius: 50%; background: rgba(59, 130, 246, 0.4); box-shadow: 0 0 16px rgba(59, 130, 246, 0.8);"></div>
            <div style="width: 16px; height: 16px; border-radius: 50%; background: #2563eb; border: 3px solid #ffffff; box-shadow: 0 0 8px rgba(0,0,0,0.6); z-index: 2;"></div>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const userMarker = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon }).addTo(layerGroup);
      userMarker.bindPopup('<div style="color:#fff; padding:4px;">📍 Tu ubicación GPS actual</div>');
    }
    
    // 2. Draw background line polylines (Differentiating standard vs prolongation *Calaverón / *Polígono)
    const isRouteActive = !!activeRoute;
    Object.keys(REAL_LINE_POLYLINES).forEach(lineCode => {
      if (selectedLineFilter && lineCode !== selectedLineFilter) return;

      const polylineArrays = REAL_LINE_POLYLINES[lineCode] || [];
      const color = LINE_COLORS[lineCode] || '#3b82f6';

      polylineArrays.forEach((coords, polyIdx) => {
        if (coords && coords.length > 0) {
          renderSegmentedPolyline(coords, lineCode, color, isRouteActive, layerGroup, polyIdx);
        }
      });
    });
    
    // 3. Draw stops (Colored rounded square badge with white border & vector bus icon)
    stopsData.forEach(stop => {
      if (selectedLineFilter && !stop.lines.includes(selectedLineFilter)) return;
      
      const isLcStop = stop.lines.includes('LC');
      const isCalaveronStop = CALAVERON_STOP_IDS.includes(String(stop.id));
      const isPoligonoExtensionStop = POLIGONO_STOP_IDS.includes(String(stop.id));
      const isExtensionStop = isCalaveronStop || isPoligonoExtensionStop;

      const bgColor = isLcStop ? '#d4af37' : '#1a4b8c';
      
      const busSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="16" x="4" y="3" rx="3"/><path d="M4 11h16"/><path d="M8 6v5"/><path d="M16 6v5"/><path d="M8 15h.01"/><path d="M16 15h.01"/><path d="M6 19v2"/><path d="M18 19v2"/></svg>`;

      const iconHTML = `
        <div style="
          width: ${isEditMode ? '24px' : '20px'}; 
          height: ${isEditMode ? '24px' : '20px'}; 
          border-radius: 6px; 
          background: ${bgColor}; 
          border: 2px solid #ffffff; 
          box-shadow: 0 2px 8px rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: ${isRouteActive ? '0.4' : '1.0'};
        ">
          ${isEditMode ? '🖐️' : busSvg}
        </div>
      `;
      
      const icon = L.divIcon({
        className: 'stop-marker',
        html: iconHTML,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });
      
      const marker = L.marker([stop.lat, stop.lng], { 
        icon,
        draggable: isEditMode
      }).addTo(layerGroup);
      
      if (isEditMode) {
        marker.on('dragend', (e) => {
          const newPos = e.target.getLatLng();
          const newLat = parseFloat(newPos.lat.toFixed(6));
          const newLng = parseFloat(newPos.lng.toFixed(6));

          updateStopPosition(stop.id, newLat, newLng);

          setLastDraggedStop({
            id: stop.id,
            name: stop.name,
            lat: newLat,
            lng: newLng
          });
        });
      }

      const extensionBadge = isCalaveronStop 
        ? `<div style="font-size:10px; color:#fbbf24; font-weight:bold; margin-bottom:4px;">⭐ Prolongación (*Calaverón)</div>` 
        : isPoligonoExtensionStop 
        ? `<div style="font-size:10px; color:#fbbf24; font-weight:bold; margin-bottom:4px;">⭐ Prolongación (*Polígono)</div>` 
        : '';

      const linesHTML = stop.lines.map(l => `<span style="display:inline-block; margin-right:4px; padding:2px 4px; background:${LINE_COLORS[l] || '#555'}; color:white; border-radius:3px; font-size:10px;">${l}</span>`).join('');
      
      const popupHTML = `
        <div style="color: #fff; background: #1f2937; padding: 10px; border-radius: 8px; width: 200px; box-sizing: border-box;">
          <h4 style="margin: 0 0 6px 0; font-size: 13px; border-bottom: 1px solid #374151; padding-bottom: 4px;">${stop.name}</h4>
          ${extensionBadge}
          <p style="font-size: 10px; color: #9ca3af; margin-bottom: 6px;">Coordenadas: ${stop.lat.toFixed(5)}, ${stop.lng.toFixed(5)}</p>
          <div style="margin-bottom: 8px;">${linesHTML}</div>
          <button id="popup-btn-${stop.id}" style="width: 100%; background: ${isLcStop ? '#d4af37' : '#2563eb'}; color: white; border: none; padding: 6px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600;">${isLcStop ? 'Ver horarios' : 'Ver Tiempos en Vivo'}</button>
        </div>
      `;
      
      marker.bindPopup(popupHTML, {
        className: 'dark-popup',
        closeButton: false,
        minWidth: 200
      });
      
      marker.on('popupopen', () => {
        const btn = document.getElementById(`popup-btn-${stop.id}`);
        if (btn) {
          btn.onclick = () => onSelectStop(stop);
        }
      });
    });

    // 4. Draw Active Route Polylines and Waypoints
    if (activeRoute) {
      if (activeRoute.originLat && activeRoute.originLng) {
        boundsPoints.push([activeRoute.originLat, activeRoute.originLng]);
        // Origin Pin
        const origIcon = L.divIcon({
          className: 'route-pin-orig',
          html: `<div style="background:#10b981; color:white; border-radius:50%; width:28px; height:28px; display:flex; align-items:center; justify-content:center; border:2px solid #fff; font-weight:bold; box-shadow:0 0 10px rgba(16,185,129,0.8); font-size:14px;">📍</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 28]
        });
        L.marker([activeRoute.originLat, activeRoute.originLng], { icon: origIcon })
          .bindPopup(`<div style="color:#fff; padding:4px;"><strong>Origen:</strong> ${activeRoute.originName}</div>`)
          .addTo(layerGroup);
      }

      if (activeRoute.destLat && activeRoute.destLng) {
        boundsPoints.push([activeRoute.destLat, activeRoute.destLng]);
        // Dest Pin
        const destIcon = L.divIcon({
          className: 'route-pin-dest',
          html: `<div style="background:#ef4444; color:white; border-radius:50%; width:28px; height:28px; display:flex; align-items:center; justify-content:center; border:2px solid #fff; font-weight:bold; box-shadow:0 0 10px rgba(239,68,68,0.8); font-size:14px;">🏁</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 28]
        });
        L.marker([activeRoute.destLat, activeRoute.destLng], { icon: destIcon })
          .bindPopup(`<div style="color:#fff; padding:4px;"><strong>Destino:</strong> ${activeRoute.destName}</div>`)
          .addTo(layerGroup);
      }

      // Process legs
      activeRoute.legs?.forEach(leg => {
        if (leg.mode === 'walk' && leg.fromCoords && leg.toCoords) {
          boundsPoints.push(leg.fromCoords, leg.toCoords);
          L.polyline([leg.fromCoords, leg.toCoords], {
            color: '#f59e0b',
            weight: 4,
            dashArray: '6, 8',
            opacity: 0.95
          }).addTo(layerGroup);
        }

        if (leg.mode === 'bus' && leg.lineCode) {
          const lineCoordsArrays = REAL_LINE_POLYLINES[leg.lineCode] || [];
          const color = leg.lineColor || LINE_COLORS[leg.lineCode] || '#3b82f6';

          const trimmedCoords = getTrimmedLegPolyline(lineCoordsArrays, leg.boardCoords, leg.alightCoords);

          if (trimmedCoords && trimmedCoords.length > 0) {
            L.polyline(trimmedCoords, {
              color: color,
              weight: 7,
              opacity: 0.95
            }).addTo(layerGroup);

            trimmedCoords.forEach(c => boundsPoints.push(c));

            // Draw directional arrow in the middle of the trimmed route segment
            if (trimmedCoords.length >= 2) {
              const midIdx = Math.floor(trimmedCoords.length / 2);
              const p1 = trimmedCoords[Math.max(0, midIdx - 1)];
              const p2 = trimmedCoords[midIdx];
              if (p1 && p2) {
                const arrowIcon = L.divIcon({
                  className: 'route-direction-arrow',
                  html: `<div style="color:${color}; font-size:18px; text-shadow:0 0 4px #fff, 0 0 8px #000; font-weight:bold;">➔</div>`,
                  iconSize: [20, 20],
                  iconAnchor: [10, 10]
                });
                L.marker(p2, { icon: arrowIcon }).addTo(layerGroup);
              }
            }
          }

          // Draw Live Bus Vehicle Marker & Boarding / Alighting Waypoints
          if (leg.boardCoords) {
            boundsPoints.push(leg.boardCoords);
            const bIcon = L.divIcon({
              className: 'live-bus-vehicle-marker',
              html: `
                <div style="position: relative; display: flex; align-items: center;">
                  <div style="
                    position: absolute; 
                    inset: -4px; 
                    border-radius: 16px; 
                    background: rgba(16, 185, 129, 0.4); 
                    box-shadow: 0 0 12px rgba(16, 185, 129, 0.8);
                    animation: pulseGps 1.8s infinite;
                  "></div>
                  <div style="
                    position: relative;
                    background: linear-gradient(135deg, ${color}, #0f172a); 
                    color: white; 
                    padding: 5px 10px; 
                    border-radius: 12px; 
                    font-weight: 800; 
                    font-size: 11px; 
                    border: 2px solid #ffffff; 
                    box-shadow: 0 4px 14px rgba(0,0,0,0.6);
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    white-space: nowrap;
                    z-index: 5;
                  ">
                    <span style="font-size: 13px;">🚌</span>
                    <span>Sube a ${leg.lineCode}</span>
                  </div>
                </div>
              `,
              iconSize: [110, 28],
              iconAnchor: [55, 14]
            });
            L.marker(leg.boardCoords, { icon: bIcon }).addTo(layerGroup);
          }

          if (leg.alightCoords) {
            boundsPoints.push(leg.alightCoords);
            const aIcon = L.divIcon({
              className: 'alight-marker',
              html: `
                <div style="
                  background: linear-gradient(135deg, #ef4444, #991b1b); 
                  color: white; 
                  padding: 5px 10px; 
                  border-radius: 12px; 
                  font-weight: 800; 
                  font-size: 11px; 
                  border: 2px solid #ffffff; 
                  box-shadow: 0 4px 14px rgba(0,0,0,0.6);
                  display: flex;
                  align-items: center;
                  gap: 5px;
                  white-space: nowrap;
                ">
                  <span>🏁</span>
                  <span>Baja en ${leg.alightStop.split('/')[0]}</span>
                </div>
              `,
              iconSize: [110, 28],
              iconAnchor: [55, 14]
            });
            L.marker(leg.alightCoords, { icon: aIcon }).addTo(layerGroup);
          }
        }
      });

      // Fit map to route bounds!
      if (boundsPoints.length > 0) {
        try {
          map.fitBounds(boundsPoints, { padding: [60, 60] });
        } catch (e) {}
      }
    }
    
  }, [selectedLineFilter, activeRoute, userLocation, onSelectStop, isEditMode, stopsData]);

  const lcStopsOnly = stopsData.filter(s => s.lines.includes('LC'));

  const handleCopyCoordinates = () => {
    const jsonStr = JSON.stringify(lcStopsOnly, null, 2);
    navigator.clipboard.writeText(jsonStr);
    alert("¡Coordenadas de paradas LC copiadas al portapapeles! Pégalas aquí en el chat para guardarlas en el código.");
  };

  return (
    <div className="map-container" style={{ position: 'relative', width: '100%', height: '100%' }}>
      
      {/* Map Canvas */}
      <div 
        ref={mapContainerRef} 
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} 
      />

      {/* Edit Mode Toggle Button */}
      <div style={{
        position: 'absolute',
        top: '16px',
        right: '16px',
        zIndex: 1000
      }}>
        <button
          onClick={() => setIsEditMode(!isEditMode)}
          style={{
            padding: '8px 14px',
            borderRadius: '12px',
            background: isEditMode ? '#dc2626' : '#2563eb',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '12px',
            border: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <span>{isEditMode ? '🔴 Desactivar Edición' : '🎯 Reubicar Paradas en Mapa'}</span>
        </button>
      </div>

      {/* Edit Mode Instructions & Live Coordinate Box */}
      {isEditMode && (
        <div style={{
          position: 'absolute',
          top: '60px',
          right: '16px',
          width: '290px',
          zIndex: 1000,
          background: 'rgba(17, 24, 39, 0.95)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '12px',
          padding: '12px',
          color: 'white',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          fontSize: '11px'
        }}>
          <h4 style={{ margin: '0 0 6px 0', fontSize: '13px', fontWeight: 'bold', color: '#60a5fa' }}>
            🖐️ Arrastra las paradas
          </h4>
          <p style={{ margin: '0 0 8px 0', color: '#9ca3af', lineHeight: '1.4' }}>
            Arrastra cualquier parada al lugar exacto. <strong>Los cambios se guardan automáticamente en tu navegador</strong> (LocalStorage).
          </p>

          {lastDraggedStop && (
            <div style={{
              background: 'rgba(37, 99, 235, 0.2)',
              border: '1px solid rgba(37, 99, 235, 0.4)',
              borderRadius: '8px',
              padding: '8px',
              marginTop: '6px'
            }}>
              <span style={{ fontWeight: 'bold', display: 'block', color: '#34d399' }}>
                ✓ Guardado: {lastDraggedStop.name}
              </span>
              <code style={{ fontSize: '11px', color: '#f3f4f6' }}>
                lat: {lastDraggedStop.lat}, lng: {lastDraggedStop.lng}
              </code>
            </div>
          )}

          <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <span style={{ fontWeight: 'bold', display: 'block', marginBottom: '4px', color: '#f59e0b' }}>
              Paradas LC (Ubicación Guardada):
            </span>
            {lcStopsOnly.map(s => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#d1d5db' }}>{s.name.slice(0, 16)}...:</span>
                <span style={{ fontFamily: 'monospace', color: '#60a5fa' }}>{s.lat.toFixed(5)}, {s.lng.toFixed(5)}</span>
              </div>
            ))}
          </div>

          <button
            onClick={handleCopyCoordinates}
            style={{
              width: '100%',
              marginTop: '10px',
              padding: '8px',
              background: '#059669',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              fontSize: '11px',
              cursor: 'pointer'
            }}
          >
            📋 Copiar Coordenadas para Chat
          </button>
        </div>
      )}

      {/* Floating Map Legend for Prolongations */}
      <div style={{
        position: 'absolute',
        top: 12,
        left: 12,
        zIndex: 1000,
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: '8px',
        padding: '6px 10px',
        fontSize: '11px',
        color: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        pointerEvents: 'none'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: '14px', height: '3px', background: '#3b82f6', borderRadius: '2px', display: 'inline-block' }}></span>
          <span>Ruta Estándar</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ borderBottom: '2px dashed #f59e0b', width: '16px', display: 'inline-block' }}></span>
          <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>⭐ Prolongación (*)</span>
        </div>
      </div>

      {/* Floating Line Chips Filter */}
      <div className="map-float-controls no-scrollbar">
        <button
          className={`map-line-chip ${selectedLineFilter === null ? 'active' : ''}`}
          onClick={() => setSelectedLineFilter(null)}
        >
          Todas
        </button>
        {LINES.map(line => (
          <button
            key={line}
            className={`map-line-chip ${selectedLineFilter === line ? 'active' : ''}`}
            onClick={() => setSelectedLineFilter(line)}
          >
            <span className="dot" style={{ background: LINE_COLORS[line] }} />
            {line}
          </button>
        ))}
      </div>

    </div>
  );
}

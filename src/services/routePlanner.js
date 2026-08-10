import { SORIA_KEY_PLACES, SORIA_LINES } from '../data/soriaLines';
import { SORIA_ALL_STOPS } from '../data/soriaLinesData';
import { AVANZA_FULL_SCHEDULES } from '../data/avanzaSchedules';
import { findMatchingStopInSchedule } from '../utils/stopMatcher';
import { fetchStopETAs, isLineActiveToday } from './avanzaApi';

export function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Get next departure time and waiting minutes based on official schedules and real-time SAE API
 */
export async function getNextDepartureInfo(lineCode, stopId, stopName) {
  const now = new Date();
  if (!isLineActiveToday(lineCode, now)) {
    return {
      timeStr: 'Sin servicio hoy',
      waitMin: 999,
      isRealTime: false,
      isStarred: false,
      label: lineCode === 'C' ? 'Solo domingos y festivos' : 'Sin servicio los domingos'
    };
  }
  // 1. Try real-time SAE API first
  try {
    const etas = await fetchStopETAs(stopId);
    if (etas && etas.length > 0) {
      const matchingBus = etas.find(b => b.lineCode === lineCode || b.desBusLine === lineCode);
      if (matchingBus && matchingBus.minutesRemaining != null) {
        return {
          timeStr: `${matchingBus.minutesRemaining} min`,
          waitMin: Math.max(1, matchingBus.minutesRemaining),
          isRealTime: true,
          isStarred: false,
          label: `SAE en Vivo (${matchingBus.minutesRemaining} min)`
        };
      }
    }
  } catch (e) {
    console.warn("Could not fetch SAE real-time ETA for route planner", e);
  }

  // 2. Fallback to Official Avanza Full Timetable Matrix
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const lineSched = AVANZA_FULL_SCHEDULES[lineCode];
  if (lineSched && lineSched.stops) {
    const matchStop = findMatchingStopInSchedule(lineSched.stops, { id: stopId, name: stopName });

    if (matchStop && matchStop.tripTimes) {
      let bestNext = null;
      let minDiff = Infinity;
      let isStarred = false;

      matchStop.tripTimes.forEach((tStr, idx) => {
        if (!tStr) return;
        const [h, m] = tStr.split(':').map(Number);
        const tripMin = h * 60 + m;
        const diff = tripMin - currentMinutes;

        if (diff >= 0 && diff < minDiff) {
          minDiff = diff;
          bestNext = tStr;
          const colType = lineSched.colTypes?.[idx] || '';
          isStarred = colType.includes('*');
        }
      });

      if (bestNext) {
        return {
          timeStr: bestNext,
          waitMin: minDiff,
          isRealTime: false,
          isStarred,
          label: `Horario oficial: ${bestNext}${isStarred ? ' (*Calaverón/Polígono)' : ''}`
        };
      }
    }
  }

  // Fallback heuristic default
  return {
    timeStr: 'Frecuencia regular',
    waitMin: 6,
    isRealTime: false,
    isStarred: false,
    label: 'Horario habitual'
  };
}

/**
 * Multi-provider Geocode text query using CartoCiudad (IGN) + ArcGIS + Nominatim fallback
 */
export async function geocodeQuery(query, userLocation = null) {
  if (!query) return null;

  if (typeof query === 'object' && query.lat && query.lng) {
    return query;
  }

  const clean = String(query).toLowerCase().trim();

  // Use exact GPS if requested or if "mi ubicación"
  if ((clean.includes("mi ubicación") || clean.includes("ubicación actual") || clean.includes("gps")) && userLocation) {
    return { name: "Tu Ubicación Actual", lat: userLocation.lat, lng: userLocation.lng };
  }

  // Check matching key places locally
  const placeMatch = SORIA_KEY_PLACES.find(p => p.name.toLowerCase().includes(clean));
  if (placeMatch) return { name: placeMatch.name, lat: placeMatch.lat, lng: placeMatch.lng };

  // Check matching stops locally
  const stopMatch = SORIA_ALL_STOPS.find(s => s.name.toLowerCase().includes(clean));
  if (stopMatch) return { name: stopMatch.name, lat: stopMatch.lat, lng: stopMatch.lng };

  // 1. Try CartoCiudad (IGN) API
  try {
    const url = `https://www.cartociudad.es/geocoder/api/geocoder/find?q=${encodeURIComponent(query + ' Soria')}`;
    const response = await fetch(url);
    if (response.ok) {
      const text = await response.text();
      if (text && text.trim().length > 0) {
        const data = JSON.parse(text);
        if (data && data.lat && data.lng) {
          return {
            name: data.address || query,
            lat: parseFloat(data.lat),
            lng: parseFloat(data.lng)
          };
        }
      }
    }
  } catch (error) {
    console.warn("CartoCiudad Geocoding failed:", error);
  }

  // 2. Try ArcGIS GeocodeServer API
  try {
    const url = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?SingleLine=${encodeURIComponent(query + ' Soria')}&countryCode=ESP&searchExtent=-2.53,41.73,-2.42,41.80&f=json`;
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      if (data.candidates && data.candidates.length > 0) {
        const cand = data.candidates[0];
        return {
          name: cand.address || query,
          lat: cand.location.y,
          lng: cand.location.x
        };
      }
    }
  } catch (error) {
    console.warn("ArcGIS Geocoding failed:", error);
  }

  // 3. Fallback: Nominatim API
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&city=Soria&countrycodes=es&limit=1`;
    const response = await fetch(url, { headers: { 'Accept-Language': 'es' }});
    const data = await response.json();
    if (data && data.length > 0) {
      const displayName = data[0].display_name.split(',')[0].trim();
      return {
        name: displayName,
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      };
    }
  } catch (error) {
    console.warn("Nominatim Geocoding failed:", error);
  }

  // Default fallback to center of Soria
  return { name: query, lat: 41.7638, lng: -2.4687 };
}

export function findNearestStop(lat, lng) {
  let nearest = null;
  let minDistance = Infinity;

  SORIA_ALL_STOPS.forEach(stop => {
    const dist = calculateDistanceMeters(lat, lng, stop.lat, stop.lng);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = { ...stop, distanceMeters: dist };
    }
  });

  return nearest;
}

/**
 * Combined Autocomplete suggestions: Soria Stops + Key Places + CartoCiudad (IGN) + ArcGIS
 */
export async function getAutocompleteSuggestions(query) {
  if (!query || query.trim().length < 2) return [];
  const clean = query.toLowerCase().trim();
  const results = [];

  // 1. Local bus stops match
  SORIA_ALL_STOPS.forEach(stop => {
    if (stop.name.toLowerCase().includes(clean) || stop.lines.some(l => l.toLowerCase() === clean)) {
      results.push({
        id: `stop-${stop.id}`,
        name: stop.name,
        type: 'stop',
        icon: '🚏',
        subtitle: `Parada de autobús (${stop.lines.join(', ')})`,
        stopId: stop.id,
        lines: stop.lines,
        lat: stop.lat,
        lng: stop.lng
      });
    }
  });

  // 2. Local key places match
  SORIA_KEY_PLACES.forEach(place => {
    if (place.name.toLowerCase().includes(clean)) {
      results.push({
        id: `place-${place.name}`,
        name: place.name,
        type: 'place',
        icon: '📍',
        subtitle: 'Lugar de interés en Soria',
        lat: place.lat,
        lng: place.lng
      });
    }
  });

  // 3. Fetch CartoCiudad (IGN) candidates
  try {
    const url = `https://www.cartociudad.es/geocoder/api/geocoder/candidates?q=${encodeURIComponent(query + ' Soria')}&limit=4`;
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data)) {
        data.forEach(item => {
          if (!results.some(r => r.name.toLowerCase() === item.address.toLowerCase())) {
            results.push({
              id: `carto-${item.id || item.address}`,
              name: item.address,
              type: 'carto',
              icon: item.type === 'callejero' ? '🗺️' : '📍',
              subtitle: `${item.poblacion || 'Soria'} (CartoCiudad IGN)`,
              lat: item.lat || 0,
              lng: item.lng || 0
            });
          }
        });
      }
    }
  } catch (error) {
    console.warn("CartoCiudad autocomplete candidates error:", error);
  }

  // 4. Fetch ArcGIS candidates
  try {
    const url = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/suggest?text=${encodeURIComponent(query + ' Soria')}&searchExtent=-2.53,41.73,-2.42,41.80&countryCode=ESP&f=json`;
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      if (data.suggestions && Array.isArray(data.suggestions)) {
        data.suggestions.forEach(item => {
          const shortName = item.text.split(',')[0].trim();
          if (!results.some(r => r.name.toLowerCase() === shortName.toLowerCase())) {
            results.push({
              id: `arcgis-${item.magicKey || item.text}`,
              name: shortName,
              type: 'arcgis',
              icon: '🌐',
              subtitle: `${item.text.split(',').slice(1, 3).join(',').trim() || 'Soria'} (ArcGIS)`,
              magicKey: item.magicKey,
              lat: 0,
              lng: 0
            });
          }
        });
      }
    }
  } catch (error) {
    console.warn("ArcGIS suggest error:", error);
  }

  return results.slice(0, 10);
}

/**
 * Robust Route Planner supporting direct lines and up to 1 transfer
 */
export async function planAddressRoute(originQuery, destQuery, userLocation = null) {
  const originGeo = typeof originQuery === 'object' && originQuery.lat 
    ? originQuery 
    : (await geocodeQuery(originQuery, userLocation) || { name: originQuery || 'Origen', lat: 41.7638, lng: -2.4687 });

  const destGeo = typeof destQuery === 'object' && destQuery.lat 
    ? destQuery 
    : (await geocodeQuery(destQuery, userLocation) || { name: destQuery || 'Destino', lat: 41.7588, lng: -2.4721 });

  // If origin and destination are extremely close (< 100m), return walking route
  const directDistance = calculateDistanceMeters(originGeo.lat, originGeo.lng, destGeo.lat, destGeo.lng);
  if (directDistance < 100) {
    const walkMin = Math.max(1, Math.round(directDistance / 70));
    return [{
      id: 'direct-walk',
      type: 'walk',
      transfers: 0,
      totalTimeMin: walkMin,
      originName: originGeo.name,
      destName: destGeo.name,
      hasRoadworks: false,
      legs: [
        {
          mode: 'walk',
          description: `Camina directamente desde ${originGeo.name} hasta ${destGeo.name}`,
          distanceMeters: directDistance,
          timeMin: walkMin
        }
      ],
      googleMapsUrl: generateGoogleMapsUrl(originGeo, destGeo)
    }];
  }

  // Find origin and destination candidate stops (top 8 nearest within 1500m)
  let originStops = SORIA_ALL_STOPS.map(s => ({ ...s, dist: calculateDistanceMeters(originGeo.lat, originGeo.lng, s.lat, s.lng) }))
    .sort((a, b) => a.dist - b.dist).slice(0, 8);
  
  let destStops = SORIA_ALL_STOPS.map(s => ({ ...s, dist: calculateDistanceMeters(destGeo.lat, destGeo.lng, s.lat, s.lng) }))
    .sort((a, b) => a.dist - b.dist).slice(0, 8);

  const results = [];
  const maxResults = 3;

  // 1. SEARCH FOR DIRECT ROUTES
  let directRoutes = [];
  originStops.forEach(oStop => {
    destStops.forEach(dStop => {
      // Find common lines between this origin stop and this destination stop that are active today
      const commonLines = oStop.lines.filter(line => dStop.lines.includes(line) && isLineActiveToday(line));
      commonLines.forEach(lineCode => {
        directRoutes.push({
          oStop, dStop, lineCode, 
          walkDistTotal: oStop.dist + dStop.dist,
          busDist: calculateDistanceMeters(oStop.lat, oStop.lng, dStop.lat, dStop.lng)
        });
      });
    });
  });

  // Sort by total walking + bus distance approx
  directRoutes.sort((a, b) => (a.walkDistTotal + a.busDist) - (b.walkDistTotal + b.busDist));

  // Add top direct routes
  for (const route of directRoutes.slice(0, 2)) {
    const lineInfo = SORIA_LINES.find(l => l.code === route.lineCode);
    const hasRoadworks = false;
    
    const depInfo = await getNextDepartureInfo(route.lineCode, route.oStop.id, route.oStop.name);
    
    const walk1Min = Math.max(1, Math.round(route.oStop.dist / 70));
    const walk2Min = Math.max(1, Math.round(route.dStop.dist / 70));
    const busMin = Math.max(2, Math.round(route.busDist / 250));
    const waitMin = depInfo.waitMin;

    results.push({
      id: `direct-${route.lineCode}-${route.oStop.id}-${route.dStop.id}`,
      type: 'direct',
      transfers: 0,
      totalTimeMin: walk1Min + waitMin + busMin + walk2Min,
      originName: originGeo.name,
      originLat: originGeo.lat,
      originLng: originGeo.lng,
      destName: destGeo.name,
      destLat: destGeo.lat,
      destLng: destGeo.lng,
      oStop: route.oStop,
      dStop: route.dStop,
      hasRoadworks,
      departureInfo: depInfo,
      legs: [
        {
          mode: 'walk',
          description: `Camina desde ${originGeo.name} hasta la parada ${route.oStop.name}`,
          fromCoords: [originGeo.lat, originGeo.lng],
          toCoords: [route.oStop.lat, route.oStop.lng],
          distanceMeters: route.oStop.dist,
          timeMin: walk1Min
        },
        {
          mode: 'bus',
          lineCode: route.lineCode,
          lineColor: lineInfo?.color || '#103056',
          badgeClass: lineInfo?.badgeClass || 'badge-l1',
          boardStop: route.oStop.name,
          boardStopId: route.oStop.id,
          boardCoords: [route.oStop.lat, route.oStop.lng],
          alightStop: route.dStop.name,
          alightStopId: route.dStop.id,
          alightCoords: [route.dStop.lat, route.dStop.lng],
          timeMin: busMin,
          realTimeMin: waitMin,
          scheduledDeparture: depInfo.timeStr,
          departureLabel: depInfo.label,
          isStarred: depInfo.isStarred
        },
        {
          mode: 'walk',
          description: `Camina desde ${route.dStop.name} hasta tu destino ${destGeo.name}`,
          fromCoords: [route.dStop.lat, route.dStop.lng],
          toCoords: [destGeo.lat, destGeo.lng],
          distanceMeters: route.dStop.dist,
          timeMin: walk2Min
        }
      ],
      googleMapsUrl: generateGoogleMapsUrl(originGeo, destGeo)
    });
  }

  // 2. SEARCH FOR 1-TRANSFER ROUTES (If less than maxResults found directly)
  if (results.length < maxResults) {
    let transferRoutes = [];
    originStops.forEach(oStop => {
      destStops.forEach(dStop => {
        oStop.lines.forEach(l1 => {
          dStop.lines.forEach(l2 => {
            if (l1 === l2) return; // Skip direct

            // Find valid transfer hubs (stops serving both l1 and l2)
            const hubs = SORIA_ALL_STOPS.filter(s => s.lines.includes(l1) && s.lines.includes(l2));
            hubs.forEach(hub => {
              const busDist1 = calculateDistanceMeters(oStop.lat, oStop.lng, hub.lat, hub.lng);
              const busDist2 = calculateDistanceMeters(hub.lat, hub.lng, dStop.lat, dStop.lng);
              
              transferRoutes.push({
                oStop, dStop, hub, l1, l2,
                score: oStop.dist + dStop.dist + busDist1 + busDist2
              });
            });
          });
        });
      });
    });

    transferRoutes.sort((a, b) => a.score - b.score);

    // Pick the best transfer route to fill up the results
    const addedTransferPairs = new Set();
    transferRoutes.forEach(route => {
      if (results.length >= maxResults) return;
      const pairKey = `${route.l1}-${route.l2}`;
      if (addedTransferPairs.has(pairKey)) return; // Diversity: avoid duplicate line combos
      
      addedTransferPairs.add(pairKey);

      const line1Info = SORIA_LINES.find(l => l.code === route.l1);
      const line2Info = SORIA_LINES.find(l => l.code === route.l2);

      const walk1Min = Math.max(1, Math.round(route.oStop.dist / 70));
      const bus1Min = Math.max(2, Math.round(calculateDistanceMeters(route.oStop.lat, route.oStop.lng, route.hub.lat, route.hub.lng) / 250));
      const bus2Min = Math.max(2, Math.round(calculateDistanceMeters(route.hub.lat, route.hub.lng, route.dStop.lat, route.dStop.lng) / 250));
      const walk2Min = Math.max(1, Math.round(route.dStop.dist / 70));
      const wait1 = 4;
      const transferWait = 4;

      results.push({
        id: `transfer-${route.l1}-${route.l2}-${route.hub.id}`,
        type: 'transfer',
        transfers: 1,
        totalTimeMin: walk1Min + wait1 + bus1Min + transferWait + bus2Min + walk2Min,
        originName: originGeo.name,
        originLat: originGeo.lat,
        originLng: originGeo.lng,
        destName: destGeo.name,
        destLat: destGeo.lat,
        destLng: destGeo.lng,
        oStop: route.oStop,
        dStop: route.dStop,
        hub: route.hub,
        hasRoadworks: false,
        legs: [
          {
            mode: 'walk',
            description: `Camina desde ${originGeo.name} a la parada ${route.oStop.name}`,
            fromCoords: [originGeo.lat, originGeo.lng],
            toCoords: [route.oStop.lat, route.oStop.lng],
            distanceMeters: route.oStop.dist,
            timeMin: walk1Min
          },
          {
            mode: 'bus',
            lineCode: route.l1,
            lineColor: line1Info?.color || '#E31A38',
            badgeClass: line1Info?.badgeClass || 'badge-l2',
            boardStop: route.oStop.name,
            boardStopId: route.oStop.id,
            boardCoords: [route.oStop.lat, route.oStop.lng],
            alightStop: route.hub.name,
            alightStopId: route.hub.id,
            alightCoords: [route.hub.lat, route.hub.lng],
            timeMin: bus1Min,
            realTimeMin: wait1
          },
          {
            mode: 'transfer',
            description: `Transbordo en ${route.hub.name} (Espera: ~${transferWait} min)`,
            hubName: route.hub.name,
            hubCoords: [route.hub.lat, route.hub.lng],
            waitMin: transferWait
          },
          {
            mode: 'bus',
            lineCode: route.l2,
            lineColor: line2Info?.color || '#103056',
            badgeClass: line2Info?.badgeClass || 'badge-l1',
            boardStop: route.hub.name,
            boardStopId: route.hub.id,
            boardCoords: [route.hub.lat, route.hub.lng],
            alightStop: route.dStop.name,
            alightStopId: route.dStop.id,
            alightCoords: [route.dStop.lat, route.dStop.lng],
            timeMin: bus2Min,
            realTimeMin: transferWait
          },
          {
            mode: 'walk',
            description: `Camina desde ${route.dStop.name} a ${destGeo.name}`,
            fromCoords: [route.dStop.lat, route.dStop.lng],
            toCoords: [destGeo.lat, destGeo.lng],
            distanceMeters: route.dStop.dist,
            timeMin: walk2Min
          }
        ],
        googleMapsUrl: generateGoogleMapsUrl(originGeo, destGeo)
      });
    });
  }

  // Sort final results by total time
  results.sort((a, b) => a.totalTimeMin - b.totalTimeMin);
  return results;
}

export function generateGoogleMapsUrl(origin, destination) {
  const orig = origin.lat && origin.lng ? `${origin.lat},${origin.lng}` : encodeURIComponent(origin.name + ", Soria");
  const dest = destination.lat && destination.lng ? `${destination.lat},${destination.lng}` : encodeURIComponent(destination.name + ", Soria");
  return `https://www.google.com/maps/dir/?api=1&origin=${orig}&destination=${dest}&travelmode=transit`;
}

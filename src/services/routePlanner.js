import { SORIA_KEY_PLACES, SORIA_LINES } from '../data/soriaLines';
import { SORIA_ALL_STOPS } from '../data/soriaLinesData';
import { AVANZA_FULL_SCHEDULES } from '../data/avanzaSchedules';
import { TOPOLOGY_MAP } from '../data/topologyMap';
import { findMatchingStopInSchedule } from '../utils/stopMatcher';
import { fetchStopETAs, isLineActiveToday } from './avanzaApi';
import { routeDistanceBetweenStops } from './etaEngine';

export function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 999999;
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
 * Checks if toStopId is reachable from fromStopId in lineCode according to its topology and direction of travel.
 */
export function isTopologicallyReachable(lineCode, fromStopId, toStopId) {
  if (String(fromStopId) === String(toStopId)) {
    return { reachable: false, fromIdx: -1, toIdx: -1, stopsCount: 0 };
  }

  // 1. External Line (LC - Camaretas)
  if (lineCode === 'LC') {
    const lcForward = ['LC_CIVICO', 'LC_CC', 'LC_ESTACION', 'LC_DUQUES'];
    const lcReverse = ['LC_DUQUES', 'LC_ESTACION', 'LC_CC', 'LC_CIVICO'];

    const checkOrder = (ids) => {
      const i1 = ids.indexOf(String(fromStopId));
      const i2 = ids.indexOf(String(toStopId));
      if (i1 !== -1 && i2 !== -1 && i1 < i2) {
        return { reachable: true, fromIdx: i1, toIdx: i2, stopsCount: i2 - i1 };
      }
      return null;
    };

    const cToS = checkOrder(lcForward);
    if (cToS) return cToS;
    const sToC = checkOrder(lcReverse);
    if (sToC) return sToC;

    return { reachable: false, fromIdx: -1, toIdx: -1, stopsCount: 0 };
  }

  // 2. Urban Lines
  const topology = TOPOLOGY_MAP[lineCode];
  if (!topology || topology.length === 0) {
    return { reachable: false, fromIdx: -1, toIdx: -1, stopsCount: 0 };
  }

  const fromIndices = [];
  const toIndices = [];

  topology.forEach((node, idx) => {
    if (String(node.id) === String(fromStopId)) fromIndices.push(idx);
    if (String(node.id) === String(toStopId)) toIndices.push(idx);
  });

  if (fromIndices.length === 0 || toIndices.length === 0) {
    return { reachable: false, fromIdx: -1, toIdx: -1, stopsCount: 0 };
  }

  const isCircular = lineCode === 'C' || lineCode === 'EX';
  let bestCandidate = null;
  let minStops = Infinity;

  for (const fIdx of fromIndices) {
    for (const tIdx of toIndices) {
      if (fIdx < tIdx) {
        const count = tIdx - fIdx;
        if (count < minStops) {
          minStops = count;
          bestCandidate = { reachable: true, fromIdx: fIdx, toIdx: tIdx, stopsCount: count };
        }
      } else if (isCircular && fIdx > tIdx) {
        const count = topology.length - fIdx + tIdx;
        if (count < minStops) {
          minStops = count;
          bestCandidate = { reachable: true, fromIdx: fIdx, toIdx: tIdx, stopsCount: count };
        }
      }
    }
  }

  if (bestCandidate) return bestCandidate;
  return { reachable: false, fromIdx: -1, toIdx: -1, stopsCount: 0 };
}

/**
 * Calculates in-bus transit time in minutes along the topological sequence between two stops.
 */
export function calculateTransitTimeMin(lineCode, fromStopId, toStopId, departureTimeMinutes = null, date = new Date()) {
  const lineSched = AVANZA_FULL_SCHEDULES[lineCode];
  const s1 = SORIA_ALL_STOPS.find(s => String(s.id) === String(fromStopId));
  const s2 = SORIA_ALL_STOPS.find(s => String(s.id) === String(toStopId));

  // 1. Try Schedule Matrix Difference
  if (lineSched && lineSched.stops && s1 && s2) {
    const match1 = findMatchingStopInSchedule(lineSched.stops, s1);
    const match2 = findMatchingStopInSchedule(lineSched.stops, s2);

    if (match1 && match2) {
      const idx1 = lineSched.stops.indexOf(match1);
      const idx2 = lineSched.stops.indexOf(match2);

      if (idx1 !== -1 && idx2 !== -1 && idx1 < idx2) {
        const numTrips = match1.tripTimes.length;
        const curMin = departureTimeMinutes ?? (date.getHours() * 60 + date.getMinutes());

        let bestTripIdx = -1;
        let minDiff = Infinity;

        for (let i = 0; i < numTrips; i++) {
          const tStr1 = match1.tripTimes[i];
          const tStr2 = match2.tripTimes[i];
          if (!tStr1 || !tStr2) continue;

          const [h1, m1] = tStr1.split(':').map(Number);
          const t1 = h1 * 60 + m1;
          const diff = t1 - curMin;

          if (diff >= 0 && diff < minDiff) {
            minDiff = diff;
            bestTripIdx = i;
          }
        }

        if (bestTripIdx !== -1) {
          const [h1, m1] = match1.tripTimes[bestTripIdx].split(':').map(Number);
          const [h2, m2] = match2.tripTimes[bestTripIdx].split(':').map(Number);
          const transitTime = (h2 * 60 + m2) - (h1 * 60 + m1);
          if (transitTime > 0) {
            return transitTime;
          }
        }
      }
    }
  }

  // 2. Spatial / Topological Distance Fallback (250 m/min = 15 km/h average commercial speed)
  const reach = isTopologicallyReachable(lineCode, fromStopId, toStopId);
  if (reach.reachable && reach.fromIdx !== -1 && reach.toIdx !== -1) {
    const dist = routeDistanceBetweenStops(lineCode, reach.fromIdx, reach.toIdx, SORIA_ALL_STOPS);
    if (dist > 0) {
      return Math.max(1, Math.round(dist / 250));
    }
  }

  // 3. Euclidean Fallback
  if (s1 && s2) {
    const d = calculateDistanceMeters(s1.lat, s1.lng, s2.lat, s2.lng);
    return Math.max(2, Math.round(d / 250));
  }

  return 3;
}

/**
 * Get next departure time and waiting minutes based on official schedules and real-time SAE API
 */
export async function getNextDepartureInfo(
  lineCode, 
  stopId, 
  stopName, 
  getStopETAs = null, 
  minDepartureMinutes = null,
  date = new Date()
) {
  if (!isLineActiveToday(lineCode, date)) {
    return {
      timeStr: 'Sin servicio hoy',
      formattedTime: 'Sin servicio hoy',
      waitMin: 999,
      tripMin: 999,
      isRealTime: false,
      isStarred: false,
      label: lineCode === 'C' ? 'Solo domingos y festivos' : 'Sin servicio los domingos'
    };
  }

  const currentMinutes = date.getHours() * 60 + date.getMinutes();
  const targetMinMinutes = minDepartureMinutes ?? currentMinutes;
  const isTargetingNow = Math.abs(targetMinMinutes - currentMinutes) <= 15;

  // 1. Try Real-Time SAE API if departure is near the current moment
  if (isTargetingNow) {
    try {
      let etas = [];
      if (getStopETAs) {
        etas = await getStopETAs(stopId);
      } else {
        etas = await fetchStopETAs(stopId);
      }
      
      if (etas && etas.length > 0) {
        const matchingBus = etas.find(b => b.lineCode === lineCode || b.desBusLine === lineCode);
        const waitMinutes = matchingBus?.minutesArrive ?? matchingBus?.minutesRemaining;
        
        const passengerWalkDelay = targetMinMinutes - currentMinutes;
        if (matchingBus && waitMinutes != null && waitMinutes >= passengerWalkDelay) {
          const netWait = waitMinutes - passengerWalkDelay;
          const busArrivalMin = currentMinutes + waitMinutes;
          const h = Math.floor(busArrivalMin / 60) % 24;
          const m = busArrivalMin % 60;
          const formattedTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

          return {
            timeStr: `${waitMinutes} min`,
            formattedTime,
            waitMin: Math.max(1, netWait),
            tripMin: busArrivalMin,
            isRealTime: true,
            isStarred: false,
            label: `SAE en Vivo (${waitMinutes} min)`
          };
        }
      }
    } catch (e) {
      console.warn("[TUSoria Router] Could not fetch SAE real-time ETA for route planner", e);
    }
  }

  // 2. Query Official Timetable Matrix
  const lineSched = AVANZA_FULL_SCHEDULES[lineCode];
  if (lineSched && lineSched.stops) {
    const matchStop = findMatchingStopInSchedule(lineSched.stops, { id: stopId, name: stopName });

    if (matchStop && matchStop.tripTimes) {
      let bestNext = null;
      let minDiff = Infinity;
      let isStarred = false;
      let bestTripMin = 0;

      matchStop.tripTimes.forEach((tStr, idx) => {
        if (!tStr) return;
        const [h, m] = tStr.split(':').map(Number);
        const tripMin = h * 60 + m;
        const diff = tripMin - targetMinMinutes;

        if (diff >= 0 && diff < minDiff) {
          minDiff = diff;
          bestNext = tStr;
          bestTripMin = tripMin;
          const colType = lineSched.colTypes?.[idx] || '';
          isStarred = colType.includes('*');
        }
      });

      if (bestNext) {
        return {
          timeStr: bestNext,
          formattedTime: bestNext,
          waitMin: minDiff,
          tripMin: bestTripMin,
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
    formattedTime: 'Frecuencia regular',
    waitMin: 6,
    tripMin: targetMinMinutes + 6,
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

  if ((clean.includes("mi ubicación") || clean.includes("ubicación actual") || clean.includes("gps")) && userLocation) {
    return { name: "Tu Ubicación Actual", lat: userLocation.lat, lng: userLocation.lng };
  }

  const placeMatch = SORIA_KEY_PLACES.find(p => p.name.toLowerCase().includes(clean));
  if (placeMatch) return { name: placeMatch.name, lat: placeMatch.lat, lng: placeMatch.lng };

  const stopMatch = SORIA_ALL_STOPS.find(s => s.name.toLowerCase().includes(clean));
  if (stopMatch) return { name: stopMatch.name, lat: stopMatch.lat, lng: stopMatch.lng };

  // 1. CartoCiudad (IGN)
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

  // 2. ArcGIS
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

  // 3. Nominatim
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

export async function getAutocompleteSuggestions(query) {
  if (!query || query.trim().length < 2) return [];
  const clean = query.toLowerCase().trim();
  const results = [];

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
 * Formats minutes past midnight to HH:MM format
 */
export function formatMinutesToTimeString(minutes) {
  const norm = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Backward trip finder for "Llegar a las..." (arrive_by).
 * Finds the latest expedition of lineCode that gets the passenger to alightStopId
 * at or before latestAlightMinutes on the specified date.
 */
export function getArrivalTripInfo(
  lineCode,
  boardStopId,
  boardStopName,
  alightStopId,
  alightStopName,
  latestAlightMinutes,
  date = new Date()
) {
  if (!isLineActiveToday(lineCode, date)) {
    return null;
  }

  // 1. Check Avanza Schedule Matrix
  const lineSched = AVANZA_FULL_SCHEDULES[lineCode];
  if (lineSched && lineSched.stops) {
    const sBoard = findMatchingStopInSchedule(lineSched.stops, { id: boardStopId, name: boardStopName });
    const sAlight = findMatchingStopInSchedule(lineSched.stops, { id: alightStopId, name: alightStopName });

    if (sBoard && sAlight && sBoard.tripTimes && sAlight.tripTimes) {
      const idxBoard = lineSched.stops.indexOf(sBoard);
      const idxAlight = lineSched.stops.indexOf(sAlight);

      if (idxBoard !== -1 && idxAlight !== -1 && idxBoard < idxAlight) {
        let bestTripIdx = -1;
        let minDiff = Infinity;

        const numTrips = sAlight.tripTimes.length;
        for (let i = 0; i < numTrips; i++) {
          const tAlight = sAlight.tripTimes[i];
          const tBoard = sBoard.tripTimes[i];
          if (!tAlight || !tBoard) continue;

          const [hA, mA] = tAlight.split(':').map(Number);
          const alightMin = hA * 60 + mA;
          const diff = latestAlightMinutes - alightMin;

          if (diff >= 0 && diff < minDiff) {
            minDiff = diff;
            bestTripIdx = i;
          }
        }

        // If all trips arrive after latestAlightMinutes, select earliest trip of the day
        if (bestTripIdx === -1) {
          for (let i = 0; i < numTrips; i++) {
            if (sAlight.tripTimes[i] && sBoard.tripTimes[i]) {
              bestTripIdx = i;
              break;
            }
          }
        }

        if (bestTripIdx !== -1) {
          const tBoard = sBoard.tripTimes[bestTripIdx];
          const tAlight = sAlight.tripTimes[bestTripIdx];
          const [hB, mB] = tBoard.split(':').map(Number);
          const [hA, mA] = tAlight.split(':').map(Number);
          const boardTripMin = hB * 60 + mB;
          const alightTripMin = hA * 60 + mA;
          const rideMin = Math.max(1, alightTripMin - boardTripMin);
          const colType = lineSched.colTypes?.[bestTripIdx] || '';
          const isStarred = colType.includes('*');

          return {
            boardTimeStr: tBoard,
            alightTimeStr: tAlight,
            boardTripMin,
            alightTripMin,
            rideMin,
            isStarred,
            label: `Horario oficial: ${tBoard} ➔ ${tAlight}${isStarred ? ' (*Calaverón/Polígono)' : ''}`
          };
        }
      }
    }
  }

  // 2. Camaretas / General Fallback
  const transitTime = calculateTransitTimeMin(lineCode, boardStopId, alightStopId, latestAlightMinutes - 15, date);
  const estimatedBoardMin = Math.max(0, latestAlightMinutes - transitTime);
  return {
    boardTimeStr: formatMinutesToTimeString(estimatedBoardMin),
    alightTimeStr: formatMinutesToTimeString(latestAlightMinutes),
    boardTripMin: estimatedBoardMin,
    alightTripMin: latestAlightMinutes,
    rideMin: transitTime,
    isStarred: false,
    label: 'Horario programado habitual'
  };
}

/**
 * Topologically and temporally sound Route Planner supporting direct lines and synchronized transfers.
 * Supports:
 * - 'now': departure from current moment with real-time SAE
 * - 'depart_at': departure from a specified future/past hour
 * - 'arrive_by': backward planning to reach destination before a target arrival hour
 */
export async function planAddressRoute(
  originQuery, 
  destQuery, 
  userLocation = null, 
  getStopETAs = null,
  timeOptionsOrDate = null
) {
  // Normalize time options
  let timeMode = 'now';
  let targetDate = new Date();
  let targetTimeMinutes = null;
  let targetTimeStr = '';

  if (timeOptionsOrDate instanceof Date) {
    targetDate = timeOptionsOrDate;
    timeMode = 'now';
  } else if (timeOptionsOrDate && typeof timeOptionsOrDate === 'object') {
    timeMode = timeOptionsOrDate.mode || 'now';
    if (timeOptionsOrDate.targetDate) {
      targetDate = new Date(timeOptionsOrDate.targetDate);
    }
    if (timeOptionsOrDate.timeStr) {
      targetTimeStr = timeOptionsOrDate.timeStr;
      const [h, m] = timeOptionsOrDate.timeStr.split(':').map(Number);
      if (!isNaN(h) && !isNaN(m)) {
        targetTimeMinutes = h * 60 + m;
      }
    }
  }

  const isArriveBy = timeMode === 'arrive_by';
  const isDepartAt = timeMode === 'depart_at';
  const isScheduledOnly = isArriveBy || isDepartAt;

  if (targetTimeMinutes == null) {
    targetTimeMinutes = targetDate.getHours() * 60 + targetDate.getMinutes();
    targetTimeStr = formatMinutesToTimeString(targetTimeMinutes);
  }

  const originGeo = typeof originQuery === 'object' && originQuery.lat 
    ? originQuery 
    : (await geocodeQuery(originQuery, userLocation) || { name: originQuery || 'Origen', lat: 41.7638, lng: -2.4687 });

  const destGeo = typeof destQuery === 'object' && destQuery.lat 
    ? destQuery 
    : (await geocodeQuery(destQuery, userLocation) || { name: destQuery || 'Destino', lat: 41.7588, lng: -2.4721 });

  const directDistance = calculateDistanceMeters(originGeo.lat, originGeo.lng, destGeo.lat, destGeo.lng);
  
  if (directDistance < 250) {
    const walkMin = Math.max(1, Math.round(directDistance / 70));
    const departMin = isArriveBy ? (targetTimeMinutes - walkMin) : targetTimeMinutes;
    const arriveMin = departMin + walkMin;

    return [{
      id: 'direct-walk',
      type: 'walk',
      transfers: 0,
      totalTimeMin: walkMin,
      originName: originGeo.name,
      destName: destGeo.name,
      hasRoadworks: false,
      timeMode,
      departureTimeFormatted: formatMinutesToTimeString(departMin),
      arrivalTimeFormatted: formatMinutesToTimeString(arriveMin),
      legs: [
        {
          mode: 'walk',
          description: `Camina directamente desde ${originGeo.name} hasta ${destGeo.name}`,
          distanceMeters: directDistance,
          timeMin: walkMin,
          startTime: formatMinutesToTimeString(departMin),
          endTime: formatMinutesToTimeString(arriveMin)
        }
      ],
      googleMapsUrl: generateGoogleMapsUrl(originGeo, destGeo)
    }];
  }

  const originStops = SORIA_ALL_STOPS.map(s => ({ 
    ...s, 
    dist: calculateDistanceMeters(originGeo.lat, originGeo.lng, s.lat, s.lng) 
  }))
  .filter(s => s.dist <= 1200)
  .sort((a, b) => a.dist - b.dist)
  .slice(0, 6);

  const destStops = SORIA_ALL_STOPS.map(s => ({ 
    ...s, 
    dist: calculateDistanceMeters(destGeo.lat, destGeo.lng, s.lat, s.lng) 
  }))
  .filter(s => s.dist <= 1200)
  .sort((a, b) => a.dist - b.dist)
  .slice(0, 6);

  const results = [];
  const maxResults = 3;

  // 1. SEARCH FOR DIRECT ROUTES
  const directCandidates = [];
  for (const oStop of originStops) {
    for (const dStop of destStops) {
      if (String(oStop.id) === String(dStop.id)) continue;

      const commonLines = oStop.lines.filter(line => dStop.lines.includes(line) && isLineActiveToday(line, targetDate));
      
      for (const lineCode of commonLines) {
        const reach = isTopologicallyReachable(lineCode, oStop.id, dStop.id);
        if (!reach.reachable) continue;

        directCandidates.push({
          oStop,
          dStop,
          lineCode,
          reach,
          walk1Dist: oStop.dist,
          walk2Dist: dStop.dist
        });
      }
    }
  }

  directCandidates.sort((a, b) => (a.walk1Dist + a.walk2Dist + a.reach.stopsCount * 300) - (b.walk1Dist + b.walk2Dist + b.reach.stopsCount * 300));

  for (const cand of directCandidates.slice(0, 4)) {
    const lineInfo = SORIA_LINES.find(l => l.code === cand.lineCode);
    const walk1Min = Math.max(1, Math.round(cand.walk1Dist / 70));
    const walk2Min = Math.max(1, Math.round(cand.walk2Dist / 70));

    let departOriginMin = 0;
    let boardTimeMin = 0;
    let alightTimeMin = 0;
    let destArrivalMin = 0;
    let busRideMin = 0;
    let scheduledDeparture = '';
    let departureLabel = '';
    let isStarred = false;
    let waitMin = 0;

    if (isArriveBy) {
      // Arrive By Mode: Calculate backwards from target arrival time
      const latestAlightMin = targetTimeMinutes - walk2Min;
      const arrInfo = getArrivalTripInfo(
        cand.lineCode,
        cand.oStop.id,
        cand.oStop.name,
        cand.dStop.id,
        cand.dStop.name,
        latestAlightMin,
        targetDate
      );

      if (arrInfo) {
        boardTimeMin = arrInfo.boardTripMin;
        alightTimeMin = arrInfo.alightTripMin;
        busRideMin = arrInfo.rideMin;
        departOriginMin = boardTimeMin - walk1Min;
        destArrivalMin = alightTimeMin + walk2Min;
        scheduledDeparture = arrInfo.boardTimeStr;
        departureLabel = arrInfo.label;
        isStarred = arrInfo.isStarred;
      } else {
        continue;
      }
    } else {
      // Depart At or Now Mode: Calculate forward
      const passengerArrivalMin = targetTimeMinutes + walk1Min;
      const depInfo = await getNextDepartureInfo(
        cand.lineCode,
        cand.oStop.id,
        cand.oStop.name,
        isScheduledOnly ? null : getStopETAs,
        passengerArrivalMin,
        targetDate
      );

      busRideMin = calculateTransitTimeMin(cand.lineCode, cand.oStop.id, cand.dStop.id, depInfo.tripMin, targetDate);
      boardTimeMin = depInfo.tripMin;
      waitMin = depInfo.waitMin;
      alightTimeMin = boardTimeMin + busRideMin;
      destArrivalMin = alightTimeMin + walk2Min;
      departOriginMin = targetTimeMinutes;
      scheduledDeparture = depInfo.timeStr;
      departureLabel = depInfo.label;
      isStarred = depInfo.isStarred;
    }

    const totalTimeMin = Math.max(1, destArrivalMin - departOriginMin);

    results.push({
      id: `direct-${cand.lineCode}-${cand.oStop.id}-${cand.dStop.id}`,
      type: 'direct',
      transfers: 0,
      totalTimeMin,
      timeMode,
      targetTimeStr,
      departureTimeFormatted: formatMinutesToTimeString(departOriginMin),
      arrivalTimeFormatted: formatMinutesToTimeString(destArrivalMin),
      originName: originGeo.name,
      originLat: originGeo.lat,
      originLng: originGeo.lng,
      destName: destGeo.name,
      destLat: destGeo.lat,
      destLng: destGeo.lng,
      oStop: cand.oStop,
      dStop: cand.dStop,
      hasRoadworks: false,
      legs: [
        {
          mode: 'walk',
          description: `Camina desde ${originGeo.name} hasta la parada ${cand.oStop.name}`,
          fromCoords: [originGeo.lat, originGeo.lng],
          toCoords: [cand.oStop.lat, cand.oStop.lng],
          distanceMeters: cand.walk1Dist,
          timeMin: walk1Min,
          startTime: formatMinutesToTimeString(departOriginMin),
          endTime: formatMinutesToTimeString(departOriginMin + walk1Min)
        },
        {
          mode: 'bus',
          lineCode: cand.lineCode,
          lineColor: lineInfo?.color || '#103056',
          badgeClass: lineInfo?.badgeClass || 'badge-l1',
          boardStop: cand.oStop.name,
          boardStopId: cand.oStop.id,
          boardCoords: [cand.oStop.lat, cand.oStop.lng],
          alightStop: cand.dStop.name,
          alightStopId: cand.dStop.id,
          alightCoords: [cand.dStop.lat, cand.dStop.lng],
          timeMin: busRideMin,
          realTimeMin: waitMin,
          scheduledDeparture,
          departureLabel,
          isStarred,
          boardTime: formatMinutesToTimeString(boardTimeMin),
          alightTime: formatMinutesToTimeString(alightTimeMin)
        },
        {
          mode: 'walk',
          description: `Camina desde ${cand.dStop.name} hasta tu destino ${destGeo.name}`,
          fromCoords: [cand.dStop.lat, cand.dStop.lng],
          toCoords: [destGeo.lat, destGeo.lng],
          distanceMeters: cand.walk2Dist,
          timeMin: walk2Min,
          startTime: formatMinutesToTimeString(alightTimeMin),
          endTime: formatMinutesToTimeString(destArrivalMin)
        }
      ],
      googleMapsUrl: generateGoogleMapsUrl(originGeo, destGeo)
    });
  }

  // 2. SEARCH FOR 1-TRANSFER ROUTES
  const transferCandidates = [];
  for (const oStop of originStops) {
    for (const dStop of destStops) {
      if (String(oStop.id) === String(dStop.id)) continue;

      for (const l1 of oStop.lines) {
        if (!isLineActiveToday(l1, targetDate)) continue;

        for (const l2 of dStop.lines) {
          if (l1 === l2 || !isLineActiveToday(l2, targetDate)) continue;

          const hubs = SORIA_ALL_STOPS.filter(s => s.lines.includes(l1) && s.lines.includes(l2));

          for (const hub of hubs) {
            if (String(hub.id) === String(oStop.id) || String(hub.id) === String(dStop.id)) continue;

            const reach1 = isTopologicallyReachable(l1, oStop.id, hub.id);
            const reach2 = isTopologicallyReachable(l2, hub.id, dStop.id);

            if (reach1.reachable && reach2.reachable) {
              transferCandidates.push({
                oStop,
                dStop,
                hub,
                l1,
                l2,
                reach1,
                reach2,
                score: oStop.dist + dStop.dist + (reach1.stopsCount + reach2.stopsCount) * 250
              });
            }
          }
        }
      }
    }
  }

  transferCandidates.sort((a, b) => a.score - b.score);

  const seenTransferCombos = new Set();
  for (const cand of transferCandidates) {
    if (results.length >= maxResults + 2) break;

    const comboKey = `${cand.l1}-${cand.l2}-${cand.hub.id}`;
    if (seenTransferCombos.has(comboKey)) continue;
    seenTransferCombos.add(comboKey);

    const line1Info = SORIA_LINES.find(l => l.code === cand.l1);
    const line2Info = SORIA_LINES.find(l => l.code === cand.l2);

    const walk1Min = Math.max(1, Math.round(cand.oStop.dist / 70));
    const walk2Min = Math.max(1, Math.round(cand.dStop.dist / 70));

    let departOriginMin = 0;
    let board1Min = 0;
    let alight1Min = 0;
    let board2Min = 0;
    let alight2Min = 0;
    let destArrivalMin = 0;
    let bus1Min = 0;
    let bus2Min = 0;
    let transferWait = 2;
    let dep1Info = null;
    let dep2Info = null;

    if (isArriveBy) {
      // Arrive By Mode: Calculate backwards
      const latestAlight2Min = targetTimeMinutes - walk2Min;
      const arr2 = getArrivalTripInfo(cand.l2, cand.hub.id, cand.hub.name, cand.dStop.id, cand.dStop.name, latestAlight2Min, targetDate);
      if (!arr2) continue;

      board2Min = arr2.boardTripMin;
      alight2Min = arr2.alightTripMin;
      bus2Min = arr2.rideMin;

      const latestAlight1Min = board2Min - 2; // At least 2 min transfer margin
      const arr1 = getArrivalTripInfo(cand.l1, cand.oStop.id, cand.oStop.name, cand.hub.id, cand.hub.name, latestAlight1Min, targetDate);
      if (!arr1) continue;

      board1Min = arr1.boardTripMin;
      alight1Min = arr1.alightTripMin;
      bus1Min = arr1.rideMin;

      transferWait = Math.max(2, board2Min - alight1Min);
      departOriginMin = board1Min - walk1Min;
      destArrivalMin = alight2Min + walk2Min;

      dep1Info = { timeStr: arr1.boardTimeStr, label: arr1.label, isStarred: arr1.isStarred };
      dep2Info = { timeStr: arr2.boardTimeStr, label: arr2.label, isStarred: arr2.isStarred };
    } else {
      // Depart At or Now Mode: Calculate forward
      const passengerArrivalMin = targetTimeMinutes + walk1Min;
      dep1Info = await getNextDepartureInfo(cand.l1, cand.oStop.id, cand.oStop.name, isScheduledOnly ? null : getStopETAs, passengerArrivalMin, targetDate);
      bus1Min = calculateTransitTimeMin(cand.l1, cand.oStop.id, cand.hub.id, dep1Info.tripMin, targetDate);
      
      board1Min = dep1Info.tripMin;
      alight1Min = board1Min + bus1Min;
      const earliestBoard2Min = alight1Min + 2;

      dep2Info = await getNextDepartureInfo(cand.l2, cand.hub.id, cand.hub.name, null, earliestBoard2Min, targetDate);
      bus2Min = calculateTransitTimeMin(cand.l2, cand.hub.id, cand.dStop.id, dep2Info.tripMin, targetDate);
      board2Min = dep2Info.tripMin;
      alight2Min = board2Min + bus2Min;
      
      transferWait = Math.max(2, board2Min - alight1Min);
      destArrivalMin = alight2Min + walk2Min;
      departOriginMin = targetTimeMinutes;
    }

    const totalTimeMin = Math.max(1, destArrivalMin - departOriginMin);

    results.push({
      id: `transfer-${cand.l1}-${cand.l2}-${cand.hub.id}`,
      type: 'transfer',
      transfers: 1,
      totalTimeMin,
      timeMode,
      targetTimeStr,
      departureTimeFormatted: formatMinutesToTimeString(departOriginMin),
      arrivalTimeFormatted: formatMinutesToTimeString(destArrivalMin),
      originName: originGeo.name,
      originLat: originGeo.lat,
      originLng: originGeo.lng,
      destName: destGeo.name,
      destLat: destGeo.lat,
      destLng: destGeo.lng,
      oStop: cand.oStop,
      dStop: cand.dStop,
      hub: cand.hub,
      hasRoadworks: false,
      legs: [
        {
          mode: 'walk',
          description: `Camina desde ${originGeo.name} a la parada ${cand.oStop.name}`,
          fromCoords: [originGeo.lat, originGeo.lng],
          toCoords: [cand.oStop.lat, cand.oStop.lng],
          distanceMeters: cand.oStop.dist,
          timeMin: walk1Min,
          startTime: formatMinutesToTimeString(departOriginMin),
          endTime: formatMinutesToTimeString(departOriginMin + walk1Min)
        },
        {
          mode: 'bus',
          lineCode: cand.l1,
          lineColor: line1Info?.color || '#E31A38',
          badgeClass: line1Info?.badgeClass || 'badge-l2',
          boardStop: cand.oStop.name,
          boardStopId: cand.oStop.id,
          boardCoords: [cand.oStop.lat, cand.oStop.lng],
          alightStop: cand.hub.name,
          alightStopId: cand.hub.id,
          alightCoords: [cand.hub.lat, cand.hub.lng],
          timeMin: bus1Min,
          scheduledDeparture: dep1Info.timeStr,
          departureLabel: dep1Info.label,
          boardTime: formatMinutesToTimeString(board1Min),
          alightTime: formatMinutesToTimeString(alight1Min)
        },
        {
          mode: 'transfer',
          description: `Transbordo en ${cand.hub.name} (Espera: ~${transferWait} min)`,
          hubName: cand.hub.name,
          hubCoords: [cand.hub.lat, cand.hub.lng],
          waitMin: transferWait,
          startTime: formatMinutesToTimeString(alight1Min),
          endTime: formatMinutesToTimeString(board2Min)
        },
        {
          mode: 'bus',
          lineCode: cand.l2,
          lineColor: line2Info?.color || '#103056',
          badgeClass: line2Info?.badgeClass || 'badge-l1',
          boardStop: cand.hub.name,
          boardStopId: cand.hub.id,
          boardCoords: [cand.hub.lat, cand.hub.lng],
          alightStop: cand.dStop.name,
          alightStopId: cand.dStop.id,
          alightCoords: [cand.dStop.lat, cand.dStop.lng],
          timeMin: bus2Min,
          scheduledDeparture: dep2Info.timeStr,
          departureLabel: dep2Info.label,
          boardTime: formatMinutesToTimeString(board2Min),
          alightTime: formatMinutesToTimeString(alight2Min)
        },
        {
          mode: 'walk',
          description: `Camina desde ${cand.dStop.name} a ${destGeo.name}`,
          fromCoords: [cand.dStop.lat, cand.dStop.lng],
          toCoords: [destGeo.lat, destGeo.lng],
          distanceMeters: cand.dStop.dist,
          timeMin: walk2Min,
          startTime: formatMinutesToTimeString(alight2Min),
          endTime: formatMinutesToTimeString(destArrivalMin)
        }
      ],
      googleMapsUrl: generateGoogleMapsUrl(originGeo, destGeo)
    });
  }

  results.sort((a, b) => a.totalTimeMin - b.totalTimeMin);
  
  const finalResults = [];
  const seenSignatures = new Set();

  for (const r of results) {
    const sig = r.legs.map(l => `${l.mode}-${l.lineCode || ''}-${l.boardStopId || ''}-${l.alightStopId || ''}`).join('|');
    if (!seenSignatures.has(sig)) {
      seenSignatures.add(sig);
      finalResults.push(r);
    }
    if (finalResults.length >= maxResults) break;
  }

  return finalResults;
}

export function generateGoogleMapsUrl(origin, destination) {
  const orig = origin.lat && origin.lng ? `${origin.lat},${origin.lng}` : encodeURIComponent(origin.name + ", Soria");
  const dest = destination.lat && destination.lng ? `${destination.lat},${destination.lng}` : encodeURIComponent(destination.name + ", Soria");
  return `https://www.google.com/maps/dir/?api=1&origin=${orig}&destination=${dest}&travelmode=transit`;
}

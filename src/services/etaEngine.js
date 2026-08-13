import { SORIA_ALL_STOPS, REAL_LINE_POLYLINES } from '../data/soriaLinesData.js';
import { AVANZA_FULL_SCHEDULES } from '../data/avanzaSchedules.js';

// --- STATE MANAGEMENT ---
export const _busStateMap = new Map();
const STATE_TTL_MS = 30 * 60 * 1000; // 30 minutes expiration

export function clearBusState() {
  _busStateMap.clear();
}

function getBusState(idBusSAE) {
  const state = _busStateMap.get(idBusSAE);
  if (state && (Date.now() - state.timestamp < STATE_TTL_MS)) {
    return state;
  }
  return null;
}

function updateBusState(idBusSAE, index, lat, lng) {
  if (!idBusSAE) return;
  _busStateMap.set(idBusSAE, {
    lastIndex: index,
    lat,
    lng,
    timestamp: Date.now()
  });
}

// --- TIME & SCHEDULE UTILITIES ---
function parseTimeStr(timeStr, baseDate) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date(baseDate);
  d.setHours(h, m, 0, 0);
  return d;
}

export function findActiveTripIndexForStop(lineSched, stopIdx, targetTimeMs, date) {
  if (!lineSched || !lineSched.stops) return -1;
  const stop = lineSched.stops[stopIdx];
  if (!stop || !stop.tripTimes) return -1;
  
  const numTrips = stop.tripTimes.length;
  let bestIdx = -1;
  let minDiff = Infinity;

  for (let i = 0; i < numTrips; i++) {
    const timeStr = stop.tripTimes[i];
    if (!timeStr) continue;
    
    const tripTime = parseTimeStr(timeStr, date).getTime();
    const diff = Math.abs(targetTimeMs - tripTime);
    if (diff < minDiff) {
      minDiff = diff;
      bestIdx = i;
    }
  }
  return bestIdx;
}

export function getScheduledTimeDiff(lineSched, fromIdx, toIdx, date = new Date(), expectedTimeMs = null) {
  if (!expectedTimeMs) expectedTimeMs = date.getTime();
  
  const tripIdx = findActiveTripIndexForStop(lineSched, fromIdx, expectedTimeMs, date);
  if (tripIdx === -1) return null;

  // We need to trace the time from `fromIdx` to `toIdx`. 
  // It's possible the active trip has nulls.
  // A robust way is to just find the difference in minutes between the two stops in ANY valid column if the current one has nulls.
  
  const tryGetDiff = (colIdx) => {
    let t1 = lineSched.stops[fromIdx]?.tripTimes?.[colIdx];
    let t2 = lineSched.stops[toIdx]?.tripTimes?.[colIdx];
    if (t1 && t2) {
      const d1 = parseTimeStr(t1, date);
      const d2 = parseTimeStr(t2, date);
      return Math.round((d2 - d1) / 60000);
    }
    return null;
  };

  let diff = tryGetDiff(tripIdx);
  if (diff !== null) return diff;

  // Fallback: search for any column that has both times
  const numTrips = lineSched.stops[0].tripTimes?.length || 0;
  for (let i = 0; i < numTrips; i++) {
    diff = tryGetDiff(i);
    if (diff !== null) return diff;
  }
  return null;
}

// --- INTERPOLATION ENGINE ---
export function interpolateEtaFromHubs(bus, targetStop, lineCode, hubTraffics, lineSched, allStops = SORIA_ALL_STOPS) {
  if (!lineSched || !lineSched.stops) return null;
  
  const targetIdx = lineSched.stops.findIndex(s => String(s.id || s.num) === String(targetStop.id || targetStop.num));
  if (targetIdx === -1) return null;

  // 1. Find all hub traffics for THIS bus
  const busHubTraffics = hubTraffics.filter(ht => ht.bus && ht.bus.idBusSAE === bus.idBusSAE);
  if (busHubTraffics.length === 0) return null;

  const validEtas = [];

  // 2. Evaluate up to 5 hubs
  for (const ht of busHubTraffics) {
    const hubIdx = lineSched.stops.findIndex(s => String(s.id || s.num) === String(ht.hubStopId));
    if (hubIdx === -1) continue;
    
    // Only interpolate if the target is AHEAD of the hub (or it's the exact same stop)
    if (targetIdx < hubIdx) continue;
    
    // Limit to reasonable distance (e.g. 5 stops away) to avoid compounding schedule drift
    if (targetIdx - hubIdx > 5) continue;

    if (targetIdx === hubIdx) {
      validEtas.push(Math.max(1, ht.hubMinutes));
      continue;
    }

    const expectedTimeMs = Date.now() + ht.hubMinutes * 60000;
    const timeDiff = getScheduledTimeDiff(lineSched, hubIdx, targetIdx, new Date(), expectedTimeMs);
    
    if (timeDiff !== null && timeDiff >= 0) {
      validEtas.push(Math.max(1, ht.hubMinutes + timeDiff));
    }
  }

  // 3. Combine / Validate ETAs
  if (validEtas.length === 0) return null;
  if (validEtas.length === 1) return validEtas[0];

  // If multiple valid references, check for consensus
  // Sort them to find the median or filter outliers
  validEtas.sort((a, b) => a - b);
  
  const median = validEtas[Math.floor(validEtas.length / 2)];
  
  // Filter outliers (more than 5 mins away from median)
  const consensusEtas = validEtas.filter(e => Math.abs(e - median) < 5);
  
  if (consensusEtas.length === 0) return validEtas[0]; // fallback to fastest if all contradict
  
  // Average the consensus
  const sum = consensusEtas.reduce((a, b) => a + b, 0);
  return Math.round(sum / consensusEtas.length);
}

// --- GPS FALLBACK ENGINE ---
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 999999;
  const R = 6371e3; 
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function findSoriaStopForScheduleStop(schedStop, allStops = SORIA_ALL_STOPS) {
  return allStops.find(s => String(s.id) === String(schedStop.id || schedStop.num));
}

function routeDistanceBetweenStops(lineSched, fromIdx, toIdx, allStops = SORIA_ALL_STOPS) {
  if (fromIdx >= toIdx) return 0;
  let dist = 0;
  for (let i = fromIdx; i < toIdx; i++) {
    const s1 = findSoriaStopForScheduleStop(lineSched.stops[i], allStops);
    const s2 = findSoriaStopForScheduleStop(lineSched.stops[i + 1], allStops);
    if (s1 && s2) dist += calculateDistanceMeters(s1.lat, s1.lng, s2.lat, s2.lng);
  }
  return dist;
}

export function estimateEtaFromGpsWithDirection(bus, targetStop, lineCode, lineSched, allStops = SORIA_ALL_STOPS) {
  const bLat = parseFloat(bus.latitude ?? bus.lat);
  const bLng = parseFloat(bus.longitude ?? bus.lng);
  if (!bLat || !bLng || bLat === 0 || bLng === 0) return null;

  if (!lineSched || !lineSched.stops) return null;
  const targetIdx = lineSched.stops.findIndex(s => String(s.id || s.num) === String(targetStop.id || targetStop.num));
  if (targetIdx === -1) return null;

  const state = getBusState(bus.idBusSAE);
  let bestIdx = -1;
  let minDist = Infinity;

  // Topological search: project onto segments
  for (let i = 0; i < lineSched.stops.length; i++) {
    const s = findSoriaStopForScheduleStop(lineSched.stops[i], allStops);
    if (!s) continue;
    const dist = calculateDistanceMeters(bLat, bLng, s.lat, s.lng);
    
    // Penalize backward jumps if state exists
    let penalty = 0;
    if (state) {
      if (i < state.lastIndex) {
        // Did it wrap around?
        const isWrapAround = (state.lastIndex > lineSched.stops.length - 3) && (i < 3);
        const timeSince = Date.now() - state.timestamp;
        if (!isWrapAround) {
           penalty = 999999; // Impossible jump backwards
        } else if (timeSince < 30000) {
           penalty = 999999; // Wrapped around too fast
        }
      }
    }

    const effectiveDist = dist + penalty;
    if (effectiveDist < minDist) {
      minDist = effectiveDist;
      bestIdx = i;
    }
  }

  if (bestIdx === -1 || targetIdx < bestIdx) return null;
  
  // Update state tracking
  updateBusState(bus.idBusSAE, bestIdx, bLat, bLng);

  const AVG_BUS_SPEED_MPM = 250; 
  const distBusToTarget = routeDistanceBetweenStops(lineSched, bestIdx, targetIdx, allStops);
  return Math.max(1, Math.round(distBusToTarget / AVG_BUS_SPEED_MPM));
}

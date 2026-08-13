import { SORIA_ALL_STOPS } from '../data/soriaLinesData.js';
import { TOPOLOGY_MAP } from '../data/topologyMap.js';

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

export function updateBusState(idBusSAE, index, lat, lng) {
  if (!idBusSAE) return;
  _busStateMap.set(idBusSAE, {
    lastIndex: index,
    lat,
    lng,
    timestamp: Date.now()
  });
}

// --- TOPOLOGY HELPERS ---
export function findTargetIndex(lineCode, targetStopId, busState = null, date = new Date()) {
  const topology = TOPOLOGY_MAP[lineCode];
  if (!topology) return -1;
  
  const possibleIndices = [];
  topology.forEach((s, idx) => {
    if (String(s.id) === String(targetStopId)) {
      possibleIndices.push(idx);
    }
  });

  if (possibleIndices.length === 0) return -1;
  if (possibleIndices.length === 1) return possibleIndices[0];

  // Resolve multiple instances (e.g. circular line wrap-around)
  // Step 1: Use time-based resolution (expedition progress)
  // We don't have the active trip here easily without full schedules, but wait...
  // Actually, the simplest approach for "first using time info" without full schedule parsing
  // is just if we are currently past the first one, but the first one is the only one...
  
  // Step 2: Fallback to getBusState
  if (busState && busState.lastIndex !== undefined) {
    // Find the first instance that is >= lastIndex
    const forwardIdx = possibleIndices.find(idx => idx >= busState.lastIndex);
    if (forwardIdx !== undefined) return forwardIdx;
  }
  
  // If we cannot reliably resolve (and there's no state or we are past all), do not invent
  return -1;
}

// --- TIME & SCHEDULE UTILITIES ---
function parseTimeStr(timeStr, baseDate) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date(baseDate);
  // Handle extended hours (e.g. 24:30 or 25:00 for past midnight)
  if (h >= 24) {
    d.setHours(h - 24, m, 0, 0);
    d.setDate(d.getDate() + 1);
  } else {
    d.setHours(h, m, 0, 0);
  }
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
  
  const tryGetDiff = (colIdx) => {
    let t1 = lineSched.stops[fromIdx]?.tripTimes?.[colIdx];
    let t2 = lineSched.stops[toIdx]?.tripTimes?.[colIdx];
    
    // If wrap-around (toIdx < fromIdx) and we're looking at the same column
    // the target time might actually be in the next column's first elements
    if (t1 && t2) {
      let d1 = parseTimeStr(t1, date);
      let d2 = parseTimeStr(t2, date);
      
      // If we jumped backward in time on the same column, it's highly likely a data glitch or overnight wrap
      if (toIdx < fromIdx && d2 < d1) {
         // Try to use the NEXT trip's time for the destination
         if (colIdx + 1 < lineSched.stops[toIdx].tripTimes.length) {
            const nextT2 = lineSched.stops[toIdx].tripTimes[colIdx + 1];
            if (nextT2) {
               d2 = parseTimeStr(nextT2, date);
            }
         }
      }
      
      return Math.max(0, Math.round((d2 - d1) / 60000));
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
export function interpolateEtaFromAnchor(bus, targetIdx, anchorIdx, anchorMinutes, lineCode) {
  const dist = routeDistanceBetweenStops(lineCode, anchorIdx, targetIdx);
  const AVG_BUS_SPEED_MPM = 250; // 15 km/h
  const travelMins = Math.round(dist / AVG_BUS_SPEED_MPM);
  return Math.max(1, anchorMinutes + travelMins);
}

// --- GPS FALLBACK ENGINE ---
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 999999;
  const R = 6371e3; 
  const f1 = lat1 * Math.PI / 180;
  const f2 = lat2 * Math.PI / 180;
  const df = (lat2 - lat1) * Math.PI / 180;
  const dl = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(df / 2) * Math.sin(df / 2) + Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function routeDistanceBetweenStops(lineCode, fromIdx, toIdx, allStops = SORIA_ALL_STOPS) {
  const topology = TOPOLOGY_MAP[lineCode];
  if (!topology) return 0;
  if (fromIdx === toIdx) return 0;
  
  let dist = 0;
  let curr = fromIdx;
  let maxIter = topology.length; // safety limit
  
  while (curr !== toIdx && maxIter-- > 0) {
    let next = curr + 1;
    if (next >= topology.length) {
      if (lineCode === 'C' || lineCode === 'EX') {
        next = 0; // Wrap around for circular lines
      } else {
        break; // Stop if not circular
      }
    }
    
    const s1 = allStops.find(s => String(s.id) === String(topology[curr]?.id));
    const s2 = allStops.find(s => String(s.id) === String(topology[next]?.id));
    if (s1 && s2) {
      dist += calculateDistanceMeters(s1.lat, s1.lng, s2.lat, s2.lng);
    }
    
    curr = next;
  }
  return dist;
}

export function estimateEtaFromGpsWithDirection(bus, targetStop, lineCode, lineSched, allStops = SORIA_ALL_STOPS) {
  const bLat = parseFloat(bus.latitude ?? bus.lat);
  const bLng = parseFloat(bus.longitude ?? bus.lng);
  if (!bLat || !bLng || bLat === 0 || bLng === 0) return null;

  const state = getBusState(bus.idBusSAE);
  const targetIdx = findTargetIndex(lineCode, targetStop.id, state);
  if (targetIdx === -1) return null;

  const topology = TOPOLOGY_MAP[lineCode];
  if (!topology) return null;

  let bestIdx = -1;
  let minDist = Infinity;

  for (let i = 0; i < topology.length; i++) {
    const sId = topology[i].id;
    if (!sId) continue;
    const s = allStops.find(st => String(st.id) === String(sId));
    if (!s) continue;
    
    const dist = calculateDistanceMeters(bLat, bLng, s.lat, s.lng);
    
    let penalty = 0;
    if (state) {
      if (i < state.lastIndex) {
        const isWrapAround = (state.lastIndex > topology.length - 3) && (i < 3);
        const timeSince = Date.now() - state.timestamp;
        if (!isWrapAround) {
           penalty = 999999; 
        } else if (timeSince < 30000) {
           penalty = 999999; 
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
  
  updateBusState(bus.idBusSAE, bestIdx, bLat, bLng);

  const AVG_BUS_SPEED_MPM = 250; 
  const distBusToTarget = routeDistanceBetweenStops(lineCode, bestIdx, targetIdx, allStops);
  return Math.max(1, Math.round(distBusToTarget / AVG_BUS_SPEED_MPM));
}

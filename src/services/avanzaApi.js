import { SERVICE_ALERTS } from '../data/provisionalStops';
import { SORIA_ALL_STOPS } from '../data/soriaLinesData';
import { AVANZA_FULL_SCHEDULES } from '../data/avanzaSchedules';
import { findMatchingStopInSchedule, areStopsMatching } from '../utils/stopMatcher';
import { getLinesForStop } from '../data/transitNetwork';
import { interpolateEtaFromAnchor, estimateEtaFromGpsWithDirection, findTargetIndex } from './etaEngine';
import { TOPOLOGY_MAP } from '../data/topologyMap';

const BASE_URL = 'https://soria.avanzagrupo.com';
const AVG_BUS_SPEED_MPM = 250;

export const HUB_STOP_IDS = ['1', '89', '3', '75', '85', '62', '5'];
export const BROKEN_STOPS_BLACKLIST = [
  '10', '11', '13', '16', '21', '22', '30', '44', '96', '98', 
  '99', '101', '105', '106', '107', '108', '109', '110', '111', '112', '113'
];


function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function getDefaultDestination(lineCode) {
  if (lineCode === 'L1' || lineCode === 'L3') return 'Hospital Sta. Bárbara';
  if (lineCode === 'L2') return 'Polígono / Estación';
  if (lineCode === 'EX') return 'Estación de Autobuses';
  if (lineCode === 'L4' || lineCode === 'L4E') return 'Mariano Granados';
  if (lineCode === 'C') return 'Mariano Granados';
  return 'Mariano Granados';
}

function resolveDestination(bus, lineCode) {
  return bus.desArrivalBusStop || bus.desDepartureBusStop || getDefaultDestination(lineCode);
}

function formatArrivalTime(curMin, mins) {
  const arrHour = Math.floor((curMin + mins) / 60) % 24;
  const arrMin = (curMin + mins) % 60;
  return `${String(arrHour).padStart(2, '0')}:${String(arrMin).padStart(2, '0')}`;
}

function scheduleStopIndex(lineSched, soriaStop) {
  const match = findMatchingStopInSchedule(lineSched.stops, soriaStop);
  return match ? lineSched.stops.indexOf(match) : -1;
}

function findSoriaStopForScheduleStop(schedStop) {
  return SORIA_ALL_STOPS.find(st => areStopsMatching(st.name, schedStop.name));
}

function findClosestStopIdx(lineSched, lat, lng) {
  let minD = Infinity;
  let closestIdx = -1;
  lineSched.stops.forEach((s, idx) => {
    const sData = findSoriaStopForScheduleStop(s);
    if (sData) {
      const d = calculateDistanceMeters(sData.lat, sData.lng, lat, lng);
      if (d < minD) {
        minD = d;
        closestIdx = idx;
      }
    }
  });
  return closestIdx;
}

function routeDistanceBetweenStops(lineSched, fromIdx, toIdx) {
  if (fromIdx === toIdx) return 0;
  const start = Math.min(fromIdx, toIdx);
  const end = Math.max(fromIdx, toIdx);
  let dist = 0;
  for (let i = start; i < end; i++) {
    const s1 = findSoriaStopForScheduleStop(lineSched.stops[i]);
    const s2 = findSoriaStopForScheduleStop(lineSched.stops[i + 1]);
    if (s1 && s2) dist += calculateDistanceMeters(s1.lat, s1.lng, s2.lat, s2.lng);
  }
  return dist;
}



function buildEtaRecord(bus, lineCode, mins, curMin, etaSource) {
  return {
    ...bus,
    isLive: etaSource !== 'scheduled',
    desBusLine: lineCode,
    minutesArrive: mins,
    arrivalTime: formatArrivalTime(curMin, mins),
    desArrivalBusStop: resolveDestination(bus, lineCode),
    etaSource
  };
}

async function fetchHubTraffics() {
  const results = [];
  const responses = await Promise.allSettled(
    HUB_STOP_IDS.map(id => fetch(`/api/eta?stopId=${id}`).then(r => r.ok ? r.json() : null))
  );

  responses.forEach((res, idx) => {
    const hubStopId = HUB_STOP_IDS[idx];
    if (res.status !== 'fulfilled' || !res.value?.jsontraffics2) return;
    try {
      const traffics = JSON.parse(res.value.jsontraffics2);
      traffics.forEach(b => {
        if (!b.desLocalCompany || b.desLocalCompany.toLowerCase().includes('soria')) {
          results.push({
            bus: b,
            hubStopId,
            hubMinutes: b.minutesArrive ?? b.minutesRemaining ?? null
          });
        }
      });
    } catch (e) {
      console.warn('[TUSoria API] Error parsing hub traffics', e);
    }
  });

  return results;
}



export function buildEtasFromLiveBuses(liveBuses, targetStop, targetLines) {
  const now = new Date();
  const curMin = now.getHours() * 60 + now.getMinutes();
  const matchingBuses = [];

  liveBuses.forEach(lb => {
    if (!targetLines.includes(lb.line)) return;

    const bus = {
      latitude: lb.lat,
      longitude: lb.lng,
      idBusSAE: lb.rawId || 'unknown',
      idBus: lb.rawId,
      lat: lb.lat,
      lng: lb.lng
    };
    
    const lineSched = AVANZA_FULL_SCHEDULES[lb.line];
    
    // We don't have hub entries here, so we only use GPS fallback
    const mins = estimateEtaFromGpsWithDirection(bus, targetStop, lb.line, lineSched);
    if (mins === null) return;

    matchingBuses.push(buildEtaRecord(bus, lb.line, mins, curMin, 'gps'));
  });

  matchingBuses.sort((a, b) => a.minutesArrive - b.minutesArrive);
  return matchingBuses;
}

/**
 * Fetch real-time arrivals for a specific stop ID in Soria
 */
export async function fetchStopETAs(stopId, options = {}) {
  const { liveBuses = null, directOnly = false } = options;
  const targetStop = SORIA_ALL_STOPS.find(s => String(s.id) === String(stopId));
  const targetLines = targetStop ? targetStop.lines.filter(l => l !== 'LC') : [];

  if (!targetStop || targetLines.length === 0) {
    return directOnly ? [] : getFallbackETAs(stopId);
  }

  const now = new Date();
  const curMin = now.getHours() * 60 + now.getMinutes();

  // 1. REAL: Try querying the specific stopId directly
  try {
    const proxyEndpoint = `/api/eta?stopId=${encodeURIComponent(stopId)}`;
    const response = await fetch(proxyEndpoint);
    if (response.ok) {
      const data = await response.json();
      const rawTraffics = data.jsontraffics2 ? JSON.parse(data.jsontraffics2) : [];
      const filtered = rawTraffics.filter(b =>
        !b.desLocalCompany || b.desLocalCompany.toLowerCase().includes('soria')
      );

      if (filtered.length > 0) {
        const directBuses = [];
        filtered.forEach(b => {
          const lineCode = normalizeLineCode(b.desBusLine, b.idBusSAE);
          if (targetLines.includes(lineCode)) {
            const mins = b.minutesArrive ?? b.minutesRemaining;
            if (mins == null) return;
            directBuses.push(buildEtaRecord(b, lineCode, mins, curMin, 'direct'));
          }
        });

        if (directBuses.length > 0) {
          return directBuses;
        }
      }
    }
  } catch (error) {
    console.warn(`[TUSoria API] Direct stop ${stopId} query failed, trying interpolation...`, error);
  }

  if (directOnly) return [];

  // 2. INTERPOLATED: Progressive topological search
  // We will keep track of buses we found to avoid duplicates
  const interpolatedBuses = [];
  const foundBusIds = new Set();
  const globalInterpolationStart = Date.now();
  const GLOBAL_TIMEOUT_MS = 3500; // 3.5 seconds global timeout
  
  const fetchWithTimeout = async (url, ms) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(id);
      return res;
    } catch (e) {
      clearTimeout(id);
      throw e;
    }
  };

  try {
    for (const lineCode of targetLines) {
      const topology = TOPOLOGY_MAP[lineCode];
      const lineSched = AVANZA_FULL_SCHEDULES[lineCode];
      if (!topology || !lineSched) continue;

      // Find target instances
      const targetIndices = [];
      topology.forEach((s, idx) => {
        if (String(s.id) === String(stopId)) targetIndices.push(idx);
      });

      for (const targetIdx of targetIndices) {
        let anchorFound = false;
        
        // Progressive backward search up to 6 positions
        for (let offset = 1; offset <= 6; offset++) {
          if (Date.now() - globalInterpolationStart > GLOBAL_TIMEOUT_MS) {
            console.warn(`[TUSoria API] Global interpolation timeout reached for ${stopId}`);
            break; 
          }

          let prevIdx = targetIdx - offset;
          if (prevIdx < 0) {
             if (lineCode === 'C' || lineCode === 'EX') {
                prevIdx = topology.length + prevIdx;
             } else {
                break;
             }
          }
          
          const prevStopId = topology[prevIdx]?.id;
          if (!prevStopId || BROKEN_STOPS_BLACKLIST.includes(String(prevStopId))) {
             continue; // Skip blacklist and undefined
          }

          // Query the anchor candidate
          try {
            const anchorRes = await fetchWithTimeout(`/api/eta?stopId=${encodeURIComponent(prevStopId)}`, 1500);
            if (!anchorRes.ok) continue;
            const anchorData = await anchorRes.json();
            const rawAnchor = anchorData.jsontraffics2 ? JSON.parse(anchorData.jsontraffics2) : [];
            
            // Filter for THIS line specifically
            const validAnchorBuses = rawAnchor.filter(b => {
               if (b.desLocalCompany && !b.desLocalCompany.toLowerCase().includes('soria')) return false;
               const bLine = normalizeLineCode(b.desBusLine, b.idBusSAE);
               return bLine === lineCode;
            });

            if (validAnchorBuses.length > 0) {
               // We found a valid anchor! Calculate interpolated ETAs for each bus found here
               validAnchorBuses.forEach(b => {
                 const anchorMins = b.minutesArrive ?? b.minutesRemaining;
                 if (anchorMins == null) return;
                 
                 const busUniqueId = b.idBusSAE || b.idBus;
                 if (foundBusIds.has(busUniqueId)) return;
                 
                 const targetEta = interpolateEtaFromAnchor(b, targetIdx, prevIdx, anchorMins, lineCode);
                 if (targetEta !== null) {
                    interpolatedBuses.push(buildEtaRecord(b, lineCode, targetEta, curMin, 'interpolated'));
                    foundBusIds.add(busUniqueId);
                 }
               });
               
               anchorFound = true;
               break; // Stop looking backward for this target instance, we found the anchor!
            }
          } catch (err) {
             // Timeout or network error, just let it continue to the next candidate
             console.warn(`[TUSoria API] Progressive anchor ${prevStopId} failed, trying next...`);
          }
        }
      }
    }
    
    if (interpolatedBuses.length > 0) {
      interpolatedBuses.sort((a, b) => a.minutesArrive - b.minutesArrive);
      return interpolatedBuses;
    }

  } catch (error) {
    console.warn('[TUSoria API] Interpolation fallback failed:', error);
  }

  // 3. GPS FALLBACK (If live buses exist but we couldn't interpolate)
  if (liveBuses && liveBuses.length > 0) {
    const fromLive = buildEtasFromLiveBuses(liveBuses, targetStop, targetLines);
    if (fromLive.length > 0) return fromLive;
  }

  // 4. SCHEDULED FALLBACK
  return getFallbackETAs(stopId);
}

/**
 * Fetch line GeoJSON geometry route
 */
export async function fetchLineGeometry(lineId) {
  const endpoint = `${BASE_URL}/detalle-linea?p_p_id=adoLinea_AdoLineaFechaPortlet_INSTANCE_sKbepqk8mA1e&p_p_lifecycle=2&p_p_state=normal&p_p_mode=view&p_p_cacheability=cacheLevelPage&_adoLinea_AdoLineaFechaPortlet_INSTANCE_sKbepqk8mA1e_cmd=getLineasMap`;

  const params = new URLSearchParams({
    "_adoLinea_AdoLineaFechaPortlet_INSTANCE_sKbepqk8mA1e_idBusLine": String(lineId)
  });

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: params.toString()
    });

    const data = await response.json();
    const det = JSON.parse(data.detalleLineaResponse || '{}');
    return {
      outTrip: det.outTrip || null,
      backTrip: det.backTrip || null
    };
  } catch (error) {
    console.warn(`[TUSoria API] Geometry fetch error for line ${lineId}:`, error);
    return null;
  }
}

/**
 * Fetch active service alerts
 */
export async function fetchServiceAlerts() {
  return SERVICE_ALERTS;
}

export function isLineActiveToday(lineCode, date = new Date()) {
  const day = date.getDay();
  if (lineCode === 'C') {
    return day === 0;
  }
  if (['L1', 'L2', 'L3', 'L4'].includes(lineCode)) {
    return day !== 0;
  }
  if (lineCode === 'L4E' || lineCode === 'EX') {
    return day >= 1 && day <= 5;
  }
  return true;
}

/**
 * Compute realistic stop-specific ETAs based on the exact lines serving the stop and schedule matrix
 */
export function getFallbackETAs(stopId) {
  const now = new Date();
  const hour = now.getHours();
  const currentMinutes = hour * 60 + now.getMinutes();

  if (hour >= 23 || hour < 7) {
    return [];
  }

  const stopObj = SORIA_ALL_STOPS.find(s => String(s.id) === String(stopId));
  if (!stopObj || !stopObj.lines || stopObj.lines.length === 0) {
    return [];
  }

  const results = [];

  stopObj.lines.forEach((lineCode, lIdx) => {
    if (lineCode === 'LC') return;
    if (!isLineActiveToday(lineCode, now)) return;

    const lineSched = AVANZA_FULL_SCHEDULES[lineCode];
    if (!lineSched || !lineSched.stops) return;

    const matchStop = findMatchingStopInSchedule(lineSched.stops, stopObj);
    if (!matchStop || !matchStop.tripTimes) return;

    let bestNext = null;
    let minDiff = Infinity;

    matchStop.tripTimes.forEach((tStr) => {
      if (!tStr) return;
      const [h, m] = tStr.split(':').map(Number);
      const tripMin = h * 60 + m;
      const diff = tripMin - currentMinutes;

      if (diff >= 0 && diff < minDiff) {
        minDiff = diff;
        bestNext = tStr;
      }
    });

    if (bestNext) {
      const arrHour = Math.floor((currentMinutes + minDiff) / 60) % 24;
      const arrMin = (currentMinutes + minDiff) % 60;
      const timeStr = `${String(arrHour).padStart(2, '0')}:${String(arrMin).padStart(2, '0')}`;

      results.push({
        idBusLine: `00${lIdx + 1}`,
        desBusLine: lineCode,
        idBus: `S-${100 + lIdx * 4 + 2}`,
        minutesArrive: minDiff,
        arrivalTime: timeStr,
        isLive: false,
        etaSource: 'scheduled',
        desDepartureBusStop: stopObj.name,
        desArrivalBusStop: getDefaultDestination(lineCode)
      });
    }
  });

  results.sort((a, b) => a.minutesArrive - b.minutesArrive);
  return results;
}

export function normalizeLineCode(rawLine, rawSae) {
  const sae = (rawSae || '').trim().toUpperCase();
  const line = (rawLine || '').trim().toUpperCase();

  if (sae === 'L1' || sae === '001' || sae === '1') return 'L1';
  if (sae === 'L2' || sae === '002' || sae === '2') return 'L2';
  if (sae === 'L3' || sae === '003' || sae === '3') return 'L3';
  if (sae === 'L4E' || sae === '012') return 'L4E';
  if (sae === 'L4' || sae === '004' || sae === '4') return 'L4';
  if (sae === 'C' || sae === '008') return 'C';
  if (sae === 'EX' || sae === '009') return 'EX';

  if (sae.startsWith('L')) return sae;

  if (line.includes('L3') || line.includes('L-3')) return 'L3';
  if (line.includes('L2') || line.includes('L-2') || line.includes('POLÍGONO') || line.includes('POLIGONO') || line.includes('BARRIADA')) return 'L2';
  if (line.includes('L4E') || line.includes('BARRIO DE LAS CASAS')) return 'L4E';
  if (line.includes('L4') || line.includes('L-4')) return 'L4';
  if (line.includes('CIRCULAR')) return 'C';
  if (line.includes('EXPRÉS') || line.includes('EXPRES')) return 'EX';
  if (line.includes('L1') || line.includes('L-1') || line.includes('PAJARITOS')) return 'L1';

  if (/^\d+$/.test(sae)) return `L${parseInt(sae, 10)}`;

  return 'L1';
}

export async function getAllLiveBuses() {
  const busesList = [];

  try {
    const responses = await Promise.allSettled(
      HUB_STOP_IDS.map(id => fetch(`/api/eta?stopId=${id}`).then(r => r.ok ? r.json() : null))
    );

    responses.forEach((res, hubIdx) => {
      const sourceHubId = HUB_STOP_IDS[hubIdx];
      if (res.status !== 'fulfilled' || !res.value?.jsontraffics2) return;

      try {
        const traffics = JSON.parse(res.value.jsontraffics2);
        traffics.forEach(b => {
          if (
            (!b.desLocalCompany || b.desLocalCompany.toLowerCase().includes('soria')) &&
            b.latitude && b.longitude && parseFloat(b.latitude) !== 0 && parseFloat(b.longitude) !== 0
          ) {
            const lineCode = normalizeLineCode(b.desBusLine, b.idBusSAE);
            const lat = parseFloat(b.latitude);
            const lng = parseFloat(b.longitude);
            const rawId = (b.idBus && String(b.idBus).trim() !== '0') ? String(b.idBus).trim() : null;
            const hubMinutes = b.minutesArrive ?? b.minutesRemaining ?? null;

            let existing = busesList.find(item => {
              if (rawId && item.rawId === rawId) return true;
              if (item.line === lineCode) {
                const dLat = item.lat - lat;
                const dLng = item.lng - lng;
                return (dLat * dLat + dLng * dLng) < 0.000001;
              }
              return false;
            });

            if (existing) {
              existing.lat = lat;
              existing.lng = lng;
              if (hubMinutes != null) {
                existing.hubMinutes = hubMinutes;
                existing.minutes = hubMinutes;
              }
              existing.sourceHubId = sourceHubId;
            } else {
              const vehicleKey = rawId ? `BUS-${rawId}` : `BUS-${lineCode}-${lat.toFixed(3)}-${lng.toFixed(3)}`;
              busesList.push({
                id: vehicleKey,
                rawId,
                line: lineCode,
                lat,
                lng,
                minutes: hubMinutes,
                hubMinutes,
                sourceHubId,
                isLive: true
              });
            }
          }
        });
      } catch (e) {
        console.warn('[TUSoria API] Error parsing traffics payload', e);
      }
    });
  } catch (err) {
    console.warn('[TUSoria API] Multi-hub live buses fetch failed', err);
  }

  return busesList;
}

import { SERVICE_ALERTS } from '../data/provisionalStops';
import { SORIA_ALL_STOPS } from '../data/soriaLinesData';
import { AVANZA_FULL_SCHEDULES } from '../data/avanzaSchedules';
import { findMatchingStopInSchedule, areStopsMatching } from '../utils/stopMatcher';

const BASE_URL = 'https://soria.avanzagrupo.com';
const AVG_BUS_SPEED_MPM = 250;

export const HUB_STOP_IDS = ['1', '89', '3', '75', '85', '62', '5'];

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

function estimateEtaFromGpsAndHub(bus, targetStop, lineCode, hubStopId, hubMinutes) {
  const bLat = parseFloat(bus.latitude ?? bus.lat);
  const bLng = parseFloat(bus.longitude ?? bus.lng);
  if (!bLat || !bLng || bLat === 0 || bLng === 0) return null;

  const lineSched = AVANZA_FULL_SCHEDULES[lineCode];
  if (!lineSched?.stops) return null;

  const closestIdx = findClosestStopIdx(lineSched, bLat, bLng);
  const targetIdx = scheduleStopIndex(lineSched, targetStop);
  // #region agent log
  if (String(targetStop.id) === '21') fetch('http://127.0.0.1:7555/ingest/e54c1fa8-acdc-4a78-ae20-0fe4789acb57',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bc2aca'},body:JSON.stringify({sessionId:'bc2aca',location:'avanzaApi.js:estimateEtaFromGpsAndHub',message:'stop21 indices',data:{lineCode,closestIdx,targetIdx,hubStopId,hubMinutes,bLat,bLng},timestamp:Date.now(),hypothesisId:'H1',runId:'post-fix'})}).catch(()=>{});
  // #endregion
  if (closestIdx === -1 || targetIdx === -1 || targetIdx < closestIdx) return null;

  if (String(targetStop.id) === String(hubStopId) && hubMinutes != null) {
    return Math.max(1, hubMinutes);
  }

  const hubStop = SORIA_ALL_STOPS.find(s => String(s.id) === String(hubStopId));
  const hubIdx = hubStop ? scheduleStopIndex(lineSched, hubStop) : -1;
  const distBusToTarget = routeDistanceBetweenStops(lineSched, closestIdx, targetIdx);

  if (hubMinutes != null && hubIdx !== -1) {
    if (targetIdx === hubIdx) return Math.max(1, hubMinutes);

    const distBusToHub = routeDistanceBetweenStops(lineSched, closestIdx, hubIdx);

    if (targetIdx > hubIdx && hubIdx >= closestIdx) {
      const distHubToTarget = routeDistanceBetweenStops(lineSched, hubIdx, targetIdx);
      return Math.max(1, hubMinutes + Math.round(distHubToTarget / AVG_BUS_SPEED_MPM));
    }

    if (targetIdx <= hubIdx && targetIdx >= closestIdx && distBusToHub > 0) {
      return Math.max(1, Math.round(hubMinutes * (distBusToTarget / distBusToHub)));
    }
  }

  return Math.max(1, Math.round(distBusToTarget / AVG_BUS_SPEED_MPM));
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

function buildEtasFromHubData(hubEntries, targetStop, targetLines) {
  const now = new Date();
  const curMin = now.getHours() * 60 + now.getMinutes();
  const matchingBuses = [];

  hubEntries.forEach(({ bus, hubStopId, hubMinutes }) => {
    const lineCode = normalizeLineCode(bus.desBusLine, bus.idBusSAE);
    if (!targetLines.includes(lineCode)) return;

    const mins = estimateEtaFromGpsAndHub(bus, targetStop, lineCode, hubStopId, hubMinutes);
    if (mins === null) return;

    matchingBuses.push(buildEtaRecord(bus, lineCode, mins, curMin, 'interpolated'));
  });

  const uniqueBuses = [];
  const seen = new Set();
  matchingBuses.forEach(b => {
    const key = `${b.desBusLine}-${b.idBus || ''}-${b.minutesArrive}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueBuses.push(b);
    }
  });

  uniqueBuses.sort((a, b) => a.minutesArrive - b.minutesArrive);
  return uniqueBuses;
}

function buildEtasFromLiveBuses(liveBuses, targetStop, targetLines) {
  const now = new Date();
  const curMin = now.getHours() * 60 + now.getMinutes();
  const matchingBuses = [];

  liveBuses.forEach(lb => {
    if (!targetLines.includes(lb.line)) return;

    const bus = {
      latitude: lb.lat,
      longitude: lb.lng,
      idBus: lb.rawId,
      lat: lb.lat,
      lng: lb.lng
    };
    const mins = estimateEtaFromGpsAndHub(
      bus,
      targetStop,
      lb.line,
      lb.sourceHubId,
      lb.hubMinutes ?? lb.minutes
    );
    if (mins === null) return;

    matchingBuses.push(buildEtaRecord(bus, lb.line, mins, curMin, 'interpolated'));
  });

  const uniqueBuses = [];
  const seen = new Set();
  matchingBuses.forEach(b => {
    const key = `${b.desBusLine}-${b.idBus || ''}-${b.minutesArrive}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueBuses.push(b);
    }
  });

  uniqueBuses.sort((a, b) => a.minutesArrive - b.minutesArrive);
  return uniqueBuses;
}

/**
 * Fetch real-time arrivals for a specific stop ID in Soria
 */
export async function fetchStopETAs(stopId, options = {}) {
  const { liveBuses = null } = options;
  const targetStop = SORIA_ALL_STOPS.find(s => String(s.id) === String(stopId));
  const targetLines = targetStop ? targetStop.lines.filter(l => l !== 'LC') : [];

  if (!targetStop || targetLines.length === 0) {
    return getFallbackETAs(stopId);
  }

  const now = new Date();
  const curMin = now.getHours() * 60 + now.getMinutes();

  // 1. Try querying the specific stopId directly
  try {
    const proxyEndpoint = `/api/eta?stopId=${encodeURIComponent(stopId)}`;
    const response = await fetch(proxyEndpoint);
    if (response.ok) {
      const data = await response.json();
      const rawTraffics = data.jsontraffics2 ? JSON.parse(data.jsontraffics2) : [];
      const filtered = rawTraffics.filter(b =>
        !b.desLocalCompany || b.desLocalCompany.toLowerCase().includes('soria')
      );
      // #region agent log
      if (String(stopId) === '21') fetch('http://127.0.0.1:7555/ingest/e54c1fa8-acdc-4a78-ae20-0fe4789acb57',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bc2aca'},body:JSON.stringify({sessionId:'bc2aca',location:'avanzaApi.js:fetchStopETAs',message:'stop21 direct query',data:{rawCount:rawTraffics.length,filteredCount:filtered.length,companies:[...new Set(rawTraffics.map(b=>b.desLocalCompany))]},timestamp:Date.now(),hypothesisId:'H2',runId:'post-fix'})}).catch(()=>{});
      // #endregion

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
    console.warn(`[TUSoria API] Direct stop ${stopId} query failed, trying hub fallback...`, error);
  }

  // 2. HUB FALLBACK: derive ETAs from live buses across network hubs
  try {
    if (liveBuses && liveBuses.length > 0) {
      const fromLive = buildEtasFromLiveBuses(liveBuses, targetStop, targetLines);
      // #region agent log
      if (String(stopId) === '21') fetch('http://127.0.0.1:7555/ingest/e54c1fa8-acdc-4a78-ae20-0fe4789acb57',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bc2aca'},body:JSON.stringify({sessionId:'bc2aca',location:'avanzaApi.js:fetchStopETAs',message:'stop21 live fallback',data:{liveBusCount:liveBuses.length,fromLiveCount:fromLive.length,lines:fromLive.map(e=>e.desBusLine),sources:fromLive.map(e=>e.etaSource)},timestamp:Date.now(),hypothesisId:'H4',runId:'post-fix'})}).catch(()=>{});
      // #endregion
      if (fromLive.length > 0) return fromLive;
    }

    const hubEntries = await fetchHubTraffics();
    const fromHubs = buildEtasFromHubData(hubEntries, targetStop, targetLines);
    // #region agent log
    if (String(stopId) === '21') fetch('http://127.0.0.1:7555/ingest/e54c1fa8-acdc-4a78-ae20-0fe4789acb57',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bc2aca'},body:JSON.stringify({sessionId:'bc2aca',location:'avanzaApi.js:fetchStopETAs',message:'stop21 hub fallback',data:{hubEntryCount:hubEntries.length,fromHubsCount:fromHubs.length,lines:fromHubs.map(e=>e.desBusLine),sources:fromHubs.map(e=>e.etaSource)},timestamp:Date.now(),hypothesisId:'H1',runId:'post-fix'})}).catch(()=>{});
    // #endregion
    if (fromHubs.length > 0) return fromHubs;
  } catch (error) {
    console.warn('[TUSoria API] Hub fallback failed:', error);
  }

  // 3. Fallback to stop-specific schedule matrix if offline / outside service hours
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

function normalizeLineCode(rawLine, rawSae) {
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

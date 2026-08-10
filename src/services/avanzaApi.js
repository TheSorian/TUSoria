import { SERVICE_ALERTS } from '../data/provisionalStops';
import { SORIA_ALL_STOPS } from '../data/soriaLinesData';
import { AVANZA_FULL_SCHEDULES } from '../data/avanzaSchedules';
import { findMatchingStopInSchedule } from '../utils/stopMatcher';

const BASE_URL = 'https://soria.avanzagrupo.com';

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

/**
 * Fetch real-time arrivals for a specific stop ID in Soria
 */
export async function fetchStopETAs(stopId) {
  const targetStop = SORIA_ALL_STOPS.find(s => String(s.id) === String(stopId));
  const targetLines = targetStop ? targetStop.lines : [];

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

      if (filtered.length > 0) {
        const directBuses = [];
        filtered.forEach(b => {
          const lineCode = b.idBusSAE ? b.idBusSAE.trim() : (b.desBusLine ? b.desBusLine.trim().split(' ')[0] : 'L1');
          if (targetLines && targetLines.includes(lineCode)) {
            directBuses.push({
              ...b,
              isLive: true,
              desBusLine: lineCode,
              minutesArrive: b.minutesArrive != null ? b.minutesArrive : b.minutesRemaining
            });
          }
        });
        
        if (directBuses.length > 0) {
          return directBuses;
        }
      }
    }
  } catch (error) {
    console.warn(`[TUSoria API] Direct stop ${stopId} query failed, trying master hub query...`, error);
  }

  // 2. MASTER HUB FALLBACK: Query Stop 1 (Mariano Granados) which returns ALL active buses running in Soria
  try {
    const masterEndpoint = `/api/eta?stopId=1`;
    const response = await fetch(masterEndpoint);
    if (response.ok) {
      const data = await response.json();
      const rawTraffics = data.jsontraffics2 ? JSON.parse(data.jsontraffics2) : [];
      const filtered = rawTraffics.filter(b => 
        !b.desLocalCompany || b.desLocalCompany.toLowerCase().includes('soria')
      );

      if (filtered.length > 0) {
        const matchingBuses = [];
        const now = new Date();
        const curMin = now.getHours() * 60 + now.getMinutes();

        filtered.forEach(b => {
          const lineCode = b.idBusSAE ? b.idBusSAE.trim() : (b.desBusLine ? b.desBusLine.trim().split(' ')[0] : 'L1');
          
          if (targetLines && targetLines.includes(lineCode)) {
            let mins = null;
            
            // If the user actually queried Stop 1, we can trust the API's minutesArrive for Stop 1 buses
            if (String(stopId) === '1' && b.minutesArrive != null) {
              mins = b.minutesArrive;
            } else if (targetStop && b.latitude && b.longitude) {
              const bLat = parseFloat(b.latitude);
              const bLng = parseFloat(b.longitude);
              if (bLat !== 0 && bLng !== 0) {
                const dist = calculateDistanceMeters(targetStop.lat, targetStop.lng, bLat, bLng);
                // Calculate ETA purely based on distance (approx 300m per min in city)
                // This is a rough estimate but much better than identical ETAs for all stops
                mins = Math.max(1, Math.round(dist / 300));
              }
            }

            // If we have no way to calculate an ETA for this stop, don't show a fake live one
            if (mins === null) return;

            const arrHour = Math.floor((curMin + mins) / 60) % 24;
            const arrMin = (curMin + mins) % 60;
            const timeStr = `${String(arrHour).padStart(2, '0')}:${String(arrMin).padStart(2, '0')}`;

            matchingBuses.push({
              ...b,
              isLive: true,
              desBusLine: lineCode,
              minutesArrive: mins,
              arrivalTime: timeStr,
              desArrivalBusStop: lineCode === 'L1' || lineCode === 'L3' ? 'Hospital Sta. Bárbara' : lineCode === 'L2' ? 'Polígono / Estación' : 'Mariano Granados'
            });
          }
        });

        if (matchingBuses.length > 0) {
          const uniqueBuses = [];
          const seen = new Set();
          matchingBuses.forEach(b => {
            const key = `${b.desBusLine}-${b.minutesArrive}`;
            if (!seen.has(key)) {
              seen.add(key);
              uniqueBuses.push(b);
            }
          });
          uniqueBuses.sort((a, b) => a.minutesArrive - b.minutesArrive);
          return uniqueBuses;
        }
      }
    }
  } catch (error) {
    console.warn(`[TUSoria API] Master hub query failed:`, error);
  }

  // 3. Fallback to stop-specific schedule matrix if offline / night time
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
  const day = date.getDay(); // 0 = Sunday, 6 = Saturday, 1..5 = Mon..Fri
  if (lineCode === 'C') {
    return day === 0; // Line C ONLY runs on Sundays & holidays
  }
  if (['L1', 'L2', 'L3', 'L4'].includes(lineCode)) {
    return day !== 0; // Mon-Sat
  }
  if (lineCode === 'L4E' || lineCode === 'EX') {
    return day >= 1 && day <= 5; // Mon-Fri
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

  // Find stop in SORIA_ALL_STOPS
  const stopObj = SORIA_ALL_STOPS.find(s => String(s.id) === String(stopId));
  if (!stopObj || !stopObj.lines || stopObj.lines.length === 0) {
    return [];
  }

  const results = [];

  stopObj.lines.forEach((lineCode, lIdx) => {
    if (lineCode === 'LC') return;
    if (!isLineActiveToday(lineCode, now)) return; // Skip lines not active today!

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
        desDepartureBusStop: stopObj.name,
        desArrivalBusStop: lineCode === 'L1' || lineCode === 'L3' ? 'Hospital Sta. Bárbara' : lineCode === 'L2' ? 'Polígono / Estación' : 'Mariano Granados'
      });
    }
  });

  results.sort((a, b) => a.minutesArrive - b.minutesArrive);
  return results;
}


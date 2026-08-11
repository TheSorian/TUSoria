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
                let interpolatedMins = null;
                const lineSched = AVANZA_FULL_SCHEDULES[lineCode];
                if (lineSched && lineSched.stops) {
                  let minD = Infinity;
                  let closestIdx = -1;
                  lineSched.stops.forEach((s, idx) => {
                    const sData = SORIA_ALL_STOPS.find(st => st.name === s.stopName);
                    if (sData) {
                      const d = calculateDistanceMeters(sData.lat, sData.lng, bLat, bLng);
                      if (d < minD) {
                        minD = d;
                        closestIdx = idx;
                      }
                    }
                  });

                  const targetIdx = lineSched.stops.findIndex(s => s.stopName === targetStop.name);
                  if (closestIdx !== -1 && targetIdx !== -1 && targetIdx >= closestIdx) {
                    const closestTimes = lineSched.stops[closestIdx].tripTimes;
                    const targetTimes = lineSched.stops[targetIdx].tripTimes;
                    let minTimeDiff = Infinity;
                    let smallestDiffToNow = Infinity;
                    
                    for (let i = 0; i < closestTimes.length; i++) {
                      if (closestTimes[i] && targetTimes[i]) {
                        const [h1, m1] = closestTimes[i].split(':').map(Number);
                        const [h2, m2] = targetTimes[i].split(':').map(Number);
                        const diff = (h2 * 60 + m2) - (h1 * 60 + m1);
                        
                        if (diff >= 0) {
                          const schedMins = h1 * 60 + m1;
                          const diffToNow = Math.abs(schedMins - curMin);
                          
                          // Match the trip that is closest to the current time
                          if (diffToNow < smallestDiffToNow) {
                            smallestDiffToNow = diffToNow;
                            minTimeDiff = diff;
                          }
                        }
                      }
                    }
                    if (minTimeDiff !== Infinity) {
                      interpolatedMins = minTimeDiff + 1; // +1 min padding
                    }
                  }
                }
                
                if (interpolatedMins !== null) {
                  mins = Math.max(1, interpolatedMins);
                }
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



function normalizeLineCode(rawLine, rawSae) {
  const sae = (rawSae || '').trim().toUpperCase();
  const line = (rawLine || '').trim().toUpperCase();

  // 1. Strict SAE code match (Exact API values)
  if (sae === 'L1' || sae === '001' || sae === '1') return 'L1';
  if (sae === 'L2' || sae === '002' || sae === '2') return 'L2';
  if (sae === 'L3' || sae === '003' || sae === '3') return 'L3';
  if (sae === 'L4E' || sae === '012') return 'L4E';
  if (sae === 'L4' || sae === '004' || sae === '4') return 'L4';
  if (sae === 'C' || sae === '008') return 'C';
  if (sae === 'EX' || sae === '009') return 'EX';

  if (sae.startsWith('L')) return sae;

  // 2. Descriptive text fallback (only if SAE is missing/unclear)
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
  // Comprehensive hub & terminal stop IDs covering all ends of the network:
  // 1: Mariano Granados, 89: El Salvador, 3: Estación, 75: Polígono, 85: Hospital Sta Bárbara, 62: Los Pajaritos, 5: San Pedro
  const hubStopIds = ['1', '89', '3', '75', '85', '62', '5'];
  const busesList = [];

  try {
    const responses = await Promise.allSettled(
      hubStopIds.map(id => fetch(`/api/eta?stopId=${id}`).then(r => r.ok ? r.json() : null))
    );

    responses.forEach(res => {
      if (res.status === 'fulfilled' && res.value && res.value.jsontraffics2) {
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

              // Check if we already have this vehicle in busesList (by explicit ID or tight spatial proximity <= 50m)
              let existing = busesList.find(item => {
                if (rawId && item.rawId === rawId) return true;
                if (item.line === lineCode) {
                  const dLat = item.lat - lat;
                  const dLng = item.lng - lng;
                  return (dLat * dLat + dLng * dLng) < 0.000001; // ~50m radius
                }
                return false;
              });

              if (existing) {
                // Update coordinates of existing detected bus
                existing.lat = lat;
                existing.lng = lng;
                if (b.minutesArrive != null) existing.minutes = b.minutesArrive;
              } else {
                // Create new bus entry with unique key
                const vehicleKey = rawId ? `BUS-${rawId}` : `BUS-${lineCode}-${lat.toFixed(3)}-${lng.toFixed(3)}`;
                busesList.push({
                  id: vehicleKey,
                  rawId: rawId,
                  line: lineCode,
                  lat: lat,
                  lng: lng,
                  minutes: b.minutesArrive,
                  isLive: true
                });
              }
            }
          });
        } catch (e) {
          console.warn('[TUSoria API] Error parsing traffics payload', e);
        }
      }
    });
  } catch (err) {
    console.warn('[TUSoria API] Multi-hub live buses fetch failed', err);
  }

  return busesList;
}

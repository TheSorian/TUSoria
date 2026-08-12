import { SORIA_ALL_STOPS, REAL_LINE_POLYLINES } from './soriaLinesData';
import { SORIA_LINES } from './soriaLines';
import { AVANZA_FULL_SCHEDULES } from './avanzaSchedules';
import { CAMARETAS_TIMETABLE } from './camaretasSchedule';

let isInitialized = false;
const stopMap = new Map();
const lineMap = new Map();

/**
 * Initializes the normalized network model in memory.
 * This should be called before accessing any of the getters.
 */
export function initTransitNetwork() {
  if (isInitialized) return;

  // 1. Initialize Stops
  SORIA_ALL_STOPS.forEach(stop => {
    // For urban lines, TUSoria stop.id strictly equals Avanza busStopID
    stopMap.set(String(stop.id), {
      ...stop,
      id: String(stop.id)
    });
  });

  // 2. Initialize Lines
  SORIA_LINES.forEach(lineDef => {
    const isLC = lineDef.code === 'LC';
    const avanzaSched = AVANZA_FULL_SCHEDULES[lineDef.code];
    const geometrySegments = REAL_LINE_POLYLINES[lineDef.code] || [];

    const line = {
      code: lineDef.code,
      metadata: {
        id: lineDef.id,
        name: lineDef.name,
        shortName: lineDef.shortName,
        color: lineDef.color,
        badgeClass: lineDef.badgeClass,
        isRealTimeAvailable: lineDef.isRealTimeAvailable,
        terminals: lineDef.terminals,
        frequencies: lineDef.frequencies,
        provider: isLC ? 'external' : 'avanza',
        serviceType: isLC ? 'schedule-only' : 'full'
      },
      directions: [],
      geometry: geometrySegments
    };

    if (isLC) {
      // For LC, we map its custom structure to the normalized model
      line.directions = [
        {
          id: 'camaretasToSoria',
          orderedStops: CAMARETAS_TIMETABLE.stopsOrder.camaretasToSoria.map(name => ({ name }))
        },
        {
          id: 'soriaToCamaretas',
          orderedStops: CAMARETAS_TIMETABLE.stopsOrder.soriaToCamaretas.map(name => ({ name }))
        }
      ];
    } else {
      // For Avanza lines, schedules only define a single continuous list of stops.
      // Directions A/B are implicitly handled within the sequence rather than explicitly split by the API.
      line.directions = [
        {
          id: 'default',
          orderedStops: avanzaSched?.stops || []
        }
      ];
    }

    lineMap.set(lineDef.code, line);
  });

  isInitialized = true;
}

export function getStopById(id) {
  initTransitNetwork();
  return stopMap.get(String(id)) || null;
}

export function getLineByCode(code) {
  initTransitNetwork();
  return lineMap.get(code) || null;
}

export function getLinesForStop(stopId) {
  const stop = getStopById(stopId);
  if (!stop) return [];
  // Ensure we only return line definitions that exist in the line map
  return stop.lines.map(code => getLineByCode(code)).filter(Boolean);
}

export function getDirectionsForLine(lineCode) {
  const line = getLineByCode(lineCode);
  return line ? line.directions : [];
}

export function getOrderedStopsForLine(lineCode, directionId = 'default') {
  const line = getLineByCode(lineCode);
  if (!line) return [];
  const dir = line.directions.find(d => d.id === directionId);
  return dir ? dir.orderedStops : [];
}

export function getGeometryForLine(lineCode) {
  const line = getLineByCode(lineCode);
  return line ? line.geometry : [];
}

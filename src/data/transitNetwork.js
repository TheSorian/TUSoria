import { SORIA_ALL_STOPS, REAL_LINE_POLYLINES } from './soriaLinesData';
import { SORIA_LINES } from './soriaLines';
import { AVANZA_FULL_SCHEDULES } from './avanzaSchedules';
import { CAMARETAS_TIMETABLE } from './camaretasSchedule';

let isInitialized = false;
const stopMap = new Map();
const lineMap = new Map();

/**
 * Initializes the normalized network model in memory.
 */
export function initTransitNetwork() {
  if (isInitialized) return;

  // 1. Initialize Stops
  SORIA_ALL_STOPS.forEach(stop => {
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

    if (isLC) {
      // External Bidirectional Line (LC)
      const lcLine = {
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
          provider: 'external',
        },
        serviceType: 'schedule-only',
        directions: {
          camaretasToSoria: {
            id: 'camaretasToSoria',
            orderedStops: CAMARETAS_TIMETABLE.stopsOrder.camaretasToSoria.map(name => ({ name })),
            geometryDirection: 'forward' // Logical indicator
          },
          soriaToCamaretas: {
            id: 'soriaToCamaretas',
            orderedStops: CAMARETAS_TIMETABLE.stopsOrder.soriaToCamaretas.map(name => ({ name })),
            geometryDirection: 'reverse' // Logical indicator
          }
        },
        geometry: geometrySegments // Shared physical geometry array
      };
      lineMap.set(lineDef.code, lcLine);
    } else {
      // Urban Lines (Single Direction of Operation)
      const urbanLine = {
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
          provider: 'avanza',
        },
        serviceType: 'full',
        orderedStops: avanzaSched?.stops || [],
        geometry: geometrySegments // Geometry natively matches the order of operation
      };
      lineMap.set(lineDef.code, urbanLine);
    }
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
  return stop.lines.map(code => getLineByCode(code)).filter(Boolean);
}

/**
 * Returns the ordered sequence of stops for a line.
 * For LC, you must provide a directionId ('camaretasToSoria' or 'soriaToCamaretas').
 */
export function getOrderedStopsForLine(lineCode, directionId = null) {
  const line = getLineByCode(lineCode);
  if (!line) return [];

  if (line.code === 'LC') {
    if (!directionId || !line.directions[directionId]) return [];
    return line.directions[directionId].orderedStops;
  }

  // For urban lines, there's only one operational direction
  return line.orderedStops;
}

/**
 * Retrieves the geometry for a line.
 * For LC, if a directionId is provided, it returns the geometry logically oriented for that direction.
 * Note: reversing coordinates logic can be built here if needed, but for now we expose the shared array or reversed array.
 */
export function getGeometryForLine(lineCode, directionId = null) {
  const line = getLineByCode(lineCode);
  if (!line) return [];

  if (line.code === 'LC' && directionId) {
    const dir = line.directions[directionId];
    if (dir && dir.geometryDirection === 'reverse') {
      // Create a reversed copy of the segments without mutating the original
      // A segment is an array of [lat, lng], so we reverse the points in each segment, 
      // and reverse the order of segments.
      return [...line.geometry].map(segment => [...segment].reverse()).reverse();
    }
  }

  return line.geometry;
}

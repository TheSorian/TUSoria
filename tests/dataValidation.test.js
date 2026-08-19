import { describe, it, expect } from 'vitest';
import { SORIA_ALL_STOPS } from '../src/data/soriaLinesData';
import { SORIA_LINES } from '../src/data/soriaLines';
import { AVANZA_FULL_SCHEDULES } from '../src/data/avanzaSchedules';
import { TOPOLOGY_MAP } from '../src/data/topologyMap';

describe('Data Validation', () => {
  it('does not have duplicate stop IDs in SORIA_ALL_STOPS', () => {
    const ids = new Set();
    const duplicates = [];

    SORIA_ALL_STOPS.forEach(stop => {
      if (ids.has(stop.id)) {
        duplicates.push(stop.id);
      }
      ids.add(stop.id);
    });

    expect(duplicates, `Duplicate Stop IDs found: ${duplicates.join(', ')}`).toEqual([]);
  });

  it('all stops have valid coordinates', () => {
    const invalidStops = [];

    SORIA_ALL_STOPS.forEach(stop => {
      if (
        typeof stop.lat !== 'number' ||
        typeof stop.lng !== 'number' ||
        isNaN(stop.lat) ||
        isNaN(stop.lng) ||
        stop.lat === 0 ||
        stop.lng === 0
      ) {
        invalidStops.push(stop.id);
      }
    });

    expect(invalidStops, `Stops with invalid coordinates: ${invalidStops.join(', ')}`).toEqual([]);
  });

  it('no references to non-existent lines in stops', () => {
    const validLineCodes = new Set(SORIA_LINES.map(l => l.code));
    const invalidReferences = [];

    SORIA_ALL_STOPS.forEach(stop => {
      stop.lines.forEach(lineCode => {
        // Exclude 'LC' from this check as it's a special line
        if (lineCode !== 'LC' && !validLineCodes.has(lineCode)) {
          invalidReferences.push({ stopId: stop.id, lineCode });
        }
      });
    });

    expect(invalidReferences, `Invalid line references in stops: ${JSON.stringify(invalidReferences)}`).toEqual([]);
  });

  it('all defined lines exist in SORIA_LINES', () => {
    const definedCodes = Object.keys(AVANZA_FULL_SCHEDULES);
    const validLineCodes = new Set(SORIA_LINES.map(l => l.code));
    const missingLines = [];

    definedCodes.forEach(code => {
      if (!validLineCodes.has(code) && code !== 'LC') {
        missingLines.push(code);
      }
    });

    expect(missingLines, `Schedules exist for lines not defined in SORIA_LINES: ${missingLines.join(', ')}`).toEqual([]);
  });

  it('all schedules in AVANZA_FULL_SCHEDULES have consistent trips and colTypes', () => {
    Object.entries(AVANZA_FULL_SCHEDULES).forEach(([lineCode, sched]) => {
      expect(sched.stops.length).toBeGreaterThan(0);
      const numTrips = sched.stops[0].tripTimes.length;
      expect(numTrips).toBeGreaterThan(0);

      sched.stops.forEach(s => {
        expect(s.tripTimes.length, `Line ${lineCode} stop ${s.name} tripTimes mismatch`).toBe(numTrips);
      });

      if (sched.colTypes) {
        expect(sched.colTypes.length, `Line ${lineCode} colTypes length mismatch`).toBe(numTrips);
      }
    });
  });

  it('all stops in TOPOLOGY_MAP are valid entries', () => {
    const topologyKeys = Object.keys(TOPOLOGY_MAP);
    const validLineCodes = new Set(SORIA_LINES.map(l => l.code));

    topologyKeys.forEach(k => {
      expect(validLineCodes.has(k), `Topology defined for unknown line ${k}`).toBe(true);
      expect(TOPOLOGY_MAP[k].length).toBeGreaterThan(0);
      TOPOLOGY_MAP[k].forEach(node => {
        expect(node.name).toBeDefined();
      });
    });
  });
});

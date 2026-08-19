import { describe, it, expect } from 'vitest';
import { TOPOLOGY_MAP } from '../src/data/topologyMap';
import { AVANZA_FULL_SCHEDULES } from '../src/data/avanzaSchedules';
import { SORIA_ALL_STOPS } from '../src/data/soriaLinesData';

describe('Topology Map Validation', () => {
  it('should have the exact same lines as avanzaSchedules (except LC)', () => {
    const avanzaLines = Object.keys(AVANZA_FULL_SCHEDULES).filter(l => l !== 'LC');
    const mappedLines = Object.keys(TOPOLOGY_MAP);
    expect(mappedLines.sort()).toEqual(avanzaLines.sort());
  });

  it('should have the exact same number of stops per line', () => {
    for (const [line, sched] of Object.entries(AVANZA_FULL_SCHEDULES)) {
      if (line === 'LC') continue;
      const mappedLine = TOPOLOGY_MAP[line];
      expect(mappedLine).toBeDefined();
      expect(mappedLine.length).toBe(sched.stops.length);
    }
  });

  it('should map every stop to a valid stopId in soriaLinesData, or null if strictly unmappable', () => {
    const validStopIds = new Set(SORIA_ALL_STOPS.map(s => String(s.id)));
    
    for (const mappedStops of Object.values(TOPOLOGY_MAP)) {
      mappedStops.forEach((stop) => {
        if (stop.id !== null) {
          expect(validStopIds.has(String(stop.id))).toBe(true);
        }
      });
    }
  });

  it('should preserve chronological order (num equivalent to array index)', () => {
    for (const [line, sched] of Object.entries(AVANZA_FULL_SCHEDULES)) {
      if (line === 'LC') continue;
      const mappedLine = TOPOLOGY_MAP[line];
      
      sched.stops.forEach((schedStop, idx) => {
        expect(mappedLine[idx].name).toBe(schedStop.name);
      });
    }
  });
});

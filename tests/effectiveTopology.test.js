import { describe, it, expect, vi } from 'vitest';
import { getEffectiveTopology } from '../src/services/etaEngine.js';
import { AVANZA_FULL_SCHEDULES } from '../src/data/avanzaSchedules.js';
import { TOPOLOGY_MAP } from '../src/data/topologyMap.js';
import { SORIA_ALL_STOPS } from '../src/data/soriaLinesData.js';

describe('Effective Topology Engine', () => {
  it('L2 normal: excludes prolongation stops and keeps Calle H and Calle N at offset 1', () => {
     // Provisional or normal trip (e.g. trip 0 is a normal trip for L2)
     const tripIdx = 0; 
     const effTopology = getEffectiveTopology('L2', tripIdx, AVANZA_FULL_SCHEDULES.L2);
     
     const calleHIdx = effTopology.findIndex(s => s.name === 'CALLE H');
     const calleNIdx = effTopology.findIndex(s => s.name === 'CALLE N');
     
     expect(calleHIdx).toBeGreaterThan(-1);
     expect(calleNIdx).toBeGreaterThan(-1);
     // Calle N should immediately follow Calle H in a normal trip
     expect(calleNIdx - calleHIdx).toBe(1);
     
     // Ensure no prolongation stops are present
     const calleD = effTopology.find(s => s.name === 'CALLE D');
     expect(calleD).toBeUndefined();
  });

  it('L2 prolongada: maintains prolongation stops and correctly spaces Calle H and Calle N', () => {
     // A known prolonged trip (e.g. trip 15 corresponds to 13:41 which goes to Poligono)
     // To be robust, let's just find the first trip that goes to Calle D
     const schedStop = AVANZA_FULL_SCHEDULES.L2.stops.find(s => String(s.num) === '10'); // Calle D is num 10 in avanzaSchedules L2
     const tripIdx = schedStop.tripTimes.findIndex(t => t !== null && t !== '');
     
     const effTopology = getEffectiveTopology('L2', tripIdx, AVANZA_FULL_SCHEDULES.L2);
     
     const calleHIdx = effTopology.findIndex(s => s.name === 'CALLE H');
     const calleNIdx = effTopology.findIndex(s => s.name === 'CALLE N');
     
     expect(calleHIdx).toBeGreaterThan(-1);
     expect(calleNIdx).toBeGreaterThan(-1);
     
     // Prolongation includes H/ABC, G, D, D/Fico, E, G, H/N between H and N
     // That is 7 intermediate stops, so offset should be 8
     expect(calleNIdx - calleHIdx).toBe(8);
     
     const calleD = effTopology.find(s => s.name === 'CALLE D');
     expect(calleD).toBeDefined();
  });

  it('L1 normal vs prolongada: exclusions work correctly', () => {
     // Find prolonged trip (Calaveron visited) vs normal trip
     const juanAntonio = AVANZA_FULL_SCHEDULES.L1.stops.find(s => s.name === 'JUAN ANTONIO SIMON');
     const normalTripIdx = juanAntonio.tripTimes.findIndex(t => t === null || t === '');
     const prolongedTripIdx = juanAntonio.tripTimes.findIndex(t => t !== null && t !== '');

     const effNormal = getEffectiveTopology('L1', normalTripIdx, AVANZA_FULL_SCHEDULES.L1);
     const effProlonged = getEffectiveTopology('L1', prolongedTripIdx, AVANZA_FULL_SCHEDULES.L1);

     expect(effNormal.find(s => s.name === 'JUAN ANTONIO SIMON')).toBeUndefined();
     expect(effProlonged.find(s => s.name === 'JUAN ANTONIO SIMON')).toBeDefined();
  });

  it('L3 normal vs prolongada: exclusions work correctly', () => {
     const juanAntonio = AVANZA_FULL_SCHEDULES.L3.stops.find(s => s.name === 'JUAN ANTONIO SIMON');
     const normalTripIdx = juanAntonio.tripTimes.findIndex(t => t === null || t === '');
     const prolongedTripIdx = juanAntonio.tripTimes.findIndex(t => t !== null && t !== '');

     const effNormal = getEffectiveTopology('L3', normalTripIdx, AVANZA_FULL_SCHEDULES.L3);
     const effProlonged = getEffectiveTopology('L3', prolongedTripIdx, AVANZA_FULL_SCHEDULES.L3);

     expect(effNormal.find(s => s.name === 'JUAN ANTONIO SIMON')).toBeUndefined();
     expect(effProlonged.find(s => s.name === 'JUAN ANTONIO SIMON')).toBeDefined();
  });

  it('Never includes a stop with null tripTime in the effective topology', () => {
     // Pick a random line and trip, assert NO stop in effectiveTopology has null tripTime
     const tripIdx = 0;
     const effTopology = getEffectiveTopology('L2', tripIdx, AVANZA_FULL_SCHEDULES.L2);
     
     for (const stop of effTopology) {
        const soriaStop = SORIA_ALL_STOPS.find(s => String(s.id) === String(stop.id));
        const schedStop = AVANZA_FULL_SCHEDULES.L2.stops.find(s => {
           // Basic mapping simulation, using the real matching logic would be identical
           // but we can trust the mapping if it passes the test
           const n1 = s.name.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
           const n2 = soriaStop.name.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
           return n1 === n2 || soriaStop.avanzaAliases?.includes(s.name);
        });
        
        if (schedStop) {
           expect(schedStop.tripTimes[tripIdx]).not.toBeNull();
           expect(schedStop.tripTimes[tripIdx]).not.toBe('');
        }
     }
  });

  it('Returns standard TOPOLOGY_MAP if tripIdx cannot be determined (-1)', () => {
     const effTopology = getEffectiveTopology('L2', -1, AVANZA_FULL_SCHEDULES.L2);
     expect(effTopology).toEqual(TOPOLOGY_MAP['L2']);
  });
});

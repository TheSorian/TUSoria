import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  calculateSmartEta, 
  clearBusState, 
  _busStateMap,
  findActiveTripIndexForStop,
  getScheduledTimeDiff,
  interpolateEtaFromHubs,
  estimateEtaFromGpsWithDirection
} from '../src/services/etaEngine.js';

// Mock schedule data for a circular line "LCircular"
const mockLineSched = {
  stops: [
    { num: '1', name: 'Start', tripTimes: [null, '10:00', '11:00'] },
    { num: '2', name: 'Stop 2', tripTimes: [null, '10:05', '11:05'] },
    { num: '3', name: 'Stop 3', tripTimes: [null, '10:10', '11:10'] },
    { num: '4', name: 'Stop 4', tripTimes: [null, '10:15', '11:15'] },
    { num: '5', name: 'End (near Start)', tripTimes: [null, '10:20', '11:20'] }
  ]
};

// Mock stops for coordinates
const mockStops = [
  { id: '1', lat: 40.000, lng: -2.000 },
  { id: '2', lat: 40.010, lng: -2.000 },
  { id: '3', lat: 40.020, lng: -2.000 },
  { id: '4', lat: 40.030, lng: -2.000 },
  { id: '5', lat: 40.001, lng: -2.001 } // Physically close to stop 1
];

describe('etaEngine', () => {
  beforeEach(() => {
    clearBusState();
    vi.useFakeTimers();
    // Set time to 10:08 so the active trip is the one starting at 10:00
    vi.setSystemTime(new Date(2026, 7, 13, 10, 8, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('1. Interpolation', () => {
    it('calculates correct time difference with prolonged schedules (nulls)', () => {
      // Test the null skipping in tripTimes
      const diff = getScheduledTimeDiff(mockLineSched, 0, 3, new Date());
      expect(diff).toBe(15); // Stop 1 (10:00) to Stop 4 (10:15)
    });

    it('interpolates using a single valid hub reference 2-4 stops away', () => {
      const bus = { idBusSAE: 'B1' };
      const targetStop = { id: '4' }; 
      
      const hubTraffics = [
        { hubStopId: '1', hubMinutes: 2, bus: { idBusSAE: 'B1' } } 
      ];

      // Stop 1 -> 4 takes 15 mins. If it's at Stop 1 in 2 mins, it will be at Stop 4 in 17 mins.
      const eta = interpolateEtaFromHubs(bus, targetStop, 'LCircular', hubTraffics, mockLineSched, mockStops);
      expect(eta).toBe(17);
    });

    it('increases confidence when two references produce the same ETA', () => {
      const bus = { idBusSAE: 'B2' };
      const targetStop = { id: '4' }; 
      
      // Stop 1 in 2 mins -> Stop 4 in 17 mins (2 + 15)
      // Stop 2 in 7 mins -> Stop 4 in 17 mins (7 + 10)
      const hubTraffics = [
        { hubStopId: '1', hubMinutes: 2, bus: { idBusSAE: 'B2' } },
        { hubStopId: '2', hubMinutes: 7, bus: { idBusSAE: 'B2' } }
      ];

      const eta = interpolateEtaFromHubs(bus, targetStop, 'LCircular', hubTraffics, mockLineSched, mockStops);
      expect(eta).toBe(17);
    });

    it('discards contradictory references and chooses the most reliable', () => {
      const bus = { idBusSAE: 'B3' };
      const targetStop = { id: '4' }; 
      
      // Stop 1 says 2 mins -> Stop 4 ETA 17
      // Stop 2 says 2 mins -> Stop 4 ETA 12 (contradictory, too fast)
      // Stop 3 says 12 mins -> Stop 4 ETA 17 (12 + 5)
      const hubTraffics = [
        { hubStopId: '1', hubMinutes: 2, bus: { idBusSAE: 'B3' } },
        { hubStopId: '2', hubMinutes: 2, bus: { idBusSAE: 'B3' } }, // Outlier
        { hubStopId: '3', hubMinutes: 12, bus: { idBusSAE: 'B3' } }
      ];

      const eta = interpolateEtaFromHubs(bus, targetStop, 'LCircular', hubTraffics, mockLineSched, mockStops);
      expect(eta).toBe(17);
    });
  });

  describe('2. GPS Fallback Directional & Topologic Tracking', () => {
    it('prevents geographic rebound in circular routes (end mapped to start)', () => {
      const bus = { idBusSAE: 'B4', latitude: 40.001, longitude: -2.001 }; // Near Stop 5 AND Stop 1
      const targetStop = { id: '4' };

      // Initialize state to show it was recently at Stop 4 (index 3)
      _busStateMap.set('B4', {
        lastIndex: 3,
        timestamp: Date.now() - 30000, // 30 secs ago
        lat: 40.030,
        lng: -2.000
      });

      const eta = estimateEtaFromGpsWithDirection(bus, targetStop, 'LCircular', mockLineSched, mockStops);
      
      // Target is Stop 4 (index 3). Bus is at Stop 5 (index 4).
      // Since index 4 > index 3, it already passed it. Should return null.
      expect(eta).toBeNull();
    });

    it('returns null if stop already passed geographically and topologically', () => {
      const bus = { idBusSAE: 'B5', latitude: 40.020, longitude: -2.000 }; // At Stop 3
      const targetStop = { id: '2' }; // Stop 2 is behind

      _busStateMap.set('B5', {
        lastIndex: 1, // Was at Stop 2
        timestamp: Date.now() - 60000
      });

      const eta = estimateEtaFromGpsWithDirection(bus, targetStop, 'LCircular', mockLineSched, mockStops);
      expect(eta).toBeNull();
    });

    it('allows jump to index 0 (cycle restart) if time elapsed is sufficient', () => {
      const bus = { idBusSAE: 'B6', latitude: 40.000, longitude: -2.000 }; // At Stop 1
      const targetStop = { id: '3' };

      // Was at Stop 5 ten minutes ago
      _busStateMap.set('B6', {
        lastIndex: 4, 
        timestamp: Date.now() - 10 * 60 * 1000, 
        lat: 40.001,
        lng: -2.001
      });

      const eta = estimateEtaFromGpsWithDirection(bus, targetStop, 'LCircular', mockLineSched, mockStops);
      // Index is allowed to wrap to 0. Stop 3 is 2 stops away.
      // Expected time based on standard 250m/min or scheduled time.
      expect(eta).toBeGreaterThan(0);
    });

    it('expires stale GPS state automatically', () => {
      const bus = { idBusSAE: 'B7', latitude: 40.000, longitude: -2.000 }; // At Stop 1
      const targetStop = { id: '2' };

      // Stale state from 2 hours ago
      _busStateMap.set('B7', {
        lastIndex: 4, 
        timestamp: Date.now() - 2 * 3600 * 1000 
      });

      const eta = estimateEtaFromGpsWithDirection(bus, targetStop, 'LCircular', mockLineSched, mockStops);
      
      // Should ignore stale state, map to index 0, and calculate ETA for index 1
      expect(eta).toBeGreaterThan(0);
    });
  });
});

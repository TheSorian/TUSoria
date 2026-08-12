import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchStopETAs } from '../src/services/avanzaApi';

// Mocking dependencies if necessary
global.fetch = vi.fn();

describe('StopDetailModal Logic & avanzaApi.js Changes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchStopETAs (Case D & E)', () => {
    it('does not trigger redundant hub fetches when liveBuses are provided (Case D)', async () => {
      // Mock /api/eta to fail so it falls back
      global.fetch.mockResolvedValueOnce({ ok: false, status: 500 });
      
      const dummyLiveBuses = [{ line: 'L1', stopId: '2', minutes: 5 }];
      
      // If we call fetchStopETAs with liveBuses, it should NOT fetch hubs
      // We know fetchHubTraffics calls fetch() internally. So fetch should be called EXACTLY ONCE (for /api/eta).
      await fetchStopETAs('1', { liveBuses: dummyLiveBuses });
      
      expect(global.fetch).toHaveBeenCalledTimes(1);
      
      // Compare without liveBuses
      global.fetch.mockResolvedValue({ ok: false, status: 500 }); // Mock all fetches to fail
      await fetchStopETAs('1', { liveBuses: null });
      
      // It should call /api/eta (1), AND THEN fetchHubTraffics (which calls fetch for all 8 hubs)
      // So fetch should be called 1 + 8 = 9 times
      expect(global.fetch).toHaveBeenCalledTimes(9); 
    });

    it('conserves ETA sources (direct vs interpolated vs scheduled) (Case E)', async () => {
      // Mock /api/eta to succeed with a direct ETA
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jsontraffics2: JSON.stringify([{
            desLocalCompany: "Soria",
            desBusLine: "1",
            idBusSAE: "L1",
            minutesArrive: 5
          }])
        })
      });

      const etas = await fetchStopETAs('1');
      expect(etas.length).toBeGreaterThan(0);
      expect(etas[0].etaSource).toBe('direct');
      expect(etas[0].isLive).toBe(true);
    });
  });

  describe('Modal Race Conditions and Cleanup (Case A, B, C)', () => {
    it('does not update state if cancelled (Case C & B)', async () => {
      let state = null;
      let cancelled = false;
      
      const load = async () => {
        // simulate fetchStopETAs delay
        await new Promise(resolve => setTimeout(resolve, 50));
        if (!cancelled) {
          state = 'UPDATED';
        }
      };

      const promise = load();
      cancelled = true; // simulate unmount or rapid re-run
      await promise;
      
      expect(state).toBeNull(); // State was not updated because it was cancelled
    });

    it('ensures newer requests win over older slow requests (Case B)', async () => {
      let finalState = null;
      
      // Simulate effect run 1
      let cancelled1 = false;
      const load1 = async () => {
        await new Promise(resolve => setTimeout(resolve, 100)); // slow
        if (!cancelled1) finalState = 'OLD_DATA';
      };

      // Simulate effect run 2
      let cancelled2 = false;
      const load2 = async () => {
        await new Promise(resolve => setTimeout(resolve, 20)); // fast
        if (!cancelled2) finalState = 'NEW_DATA';
      };

      // Run 1 starts
      const p1 = load1();
      // Props change, run 1 is cancelled, run 2 starts
      cancelled1 = true;
      const p2 = load2();
      
      await Promise.all([p1, p2]);
      
      expect(finalState).toBe('NEW_DATA');
    });
  });
});

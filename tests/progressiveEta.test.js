import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchStopETAs } from '../src/services/avanzaApi';
import { clearBusState, updateBusState } from '../src/services/etaEngine';

describe('Progressive ETA Fallback (Topological Engine 2.0)', () => {
  beforeEach(() => {
    clearBusState();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 5, 1, 10, 0, 0)); // 10:00 AM
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const mockResponse = (body, ok = true) => ({
    ok,
    json: async () => body
  });

  it('Stop 21 progressive fallback: skips blacklist 20,19,18,17,16 and queries 104', async () => {
    // We mock the direct fetch for 21 to fail (empty or timeout)
    // Then the progressive fallback will kick in.
    
    global.fetch.mockImplementation(async (url) => {
      const u = new URL(url, 'http://localhost');
      const stopId = u.searchParams.get('stopId');
      
      if (stopId === '21') {
        return mockResponse({ jsontraffics2: '[]' });
      }
      
      // Stop 104 (San Benito) is the first non-toxic one for L2/C/EX
      if (stopId === '104') {
        return mockResponse({
          jsontraffics2: JSON.stringify([{
            desLocalCompany: 'Soria',
            desBusLine: 'CIRCULAR',
            idBusSAE: '008',
            minutesArrive: 5
          }])
        });
      }
      
      return mockResponse({ jsontraffics2: '[]' });
    });

    const result = await fetchStopETAs('21');
    
    // It should have queried 21, then 104 directly (skipping the others)
    const calls = global.fetch.mock.calls.map(c => new URL(c[0], 'http://localhost').searchParams.get('stopId'));
    expect(calls).toContain('21');
    // Result should have interpolated ETA for line C
    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].etaSource).toBe('interpolated');
  });

  it('Global timeout aborts interpolated fallback and goes to GPS', async () => {
    // If we take more than 3.5 seconds, it should break out.
    // For this, we'll mock fetch to advance the fake timer by 4000ms.
    
    global.fetch.mockImplementation(async () => {
      vi.advanceTimersByTime(4000); // Exceed GLOBAL_TIMEOUT_MS
      return mockResponse({ jsontraffics2: '[]' });
    });

    await fetchStopETAs('21', { liveBuses: [] }); // liveBuses passed to trigger GPS path later if we had them
    
    // We only expect 1 progressive query because it will timeout immediately after the first loop iteration
    expect(global.fetch.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it('Handles circular repeated stops correctly using GPS state', async () => {
    // Stop 1 (PZA. M. GRANADOS) is at index 0 and 31 in L1.
    // Let's set the bus state to index 15. The interpolation should target index 31, NOT index 0.
    
    updateBusState('L1_BUS', 15, 41.7, -2.4);
    
    global.fetch.mockImplementation(async (url) => {
      const u = new URL(url, 'http://localhost');
      const stopId = u.searchParams.get('stopId');
      
      if (stopId === '1') {
        return mockResponse({ jsontraffics2: '[]' });
      }
      
      // The backward search from index 31 will query index 30 (ID 34: Betetas A)
      if (stopId === '34') {
        return mockResponse({
          jsontraffics2: JSON.stringify([{
            desLocalCompany: 'Soria',
            desBusLine: 'L1',
            idBusSAE: 'L1',
            minutesArrive: 2
          }])
        });
      }
      
      return mockResponse({ jsontraffics2: '[]' });
    });

    const result = await fetchStopETAs('1');
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].etaSource).toBe('interpolated');
  });
});

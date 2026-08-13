import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchStopETAs } from '../src/services/avanzaApi';
import * as etaEngine from '../src/services/etaEngine';

vi.mock('../src/services/etaEngine', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    findActiveTripIndexForStop: vi.fn(actual.findActiveTripIndexForStop)
  };
});

describe('Progressive ETA Fallback (Topological Engine 2.0) - Alternative Candidate', () => {
  beforeEach(() => {
    etaEngine.clearBusState();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 5, 1, 10, 0, 0));
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

  it('Alternative candidate topology: if provTripIdx excludes target stop, finds a compatible trip', async () => {
    etaEngine.findActiveTripIndexForStop
      .mockReturnValueOnce(0) // First call: provisional trip
      .mockReturnValue(1); // Subsequent calls: fallback or definitive trip


    global.fetch.mockImplementation(async (url) => {
      const u = new URL(url, 'http://localhost');
      const stopId = u.searchParams.get('stopId');
      
      if (stopId === '95') {
        return mockResponse({ jsontraffics2: '[]' });
      }
      
      if (stopId === '63') {
        return mockResponse({
          jsontraffics2: JSON.stringify([{
            desLocalCompany: 'Soria',
            desBusLine: 'L1',
            idBusSAE: '001',
            minutesArrive: 2
          }])
        });
      }
      return mockResponse({ jsontraffics2: '[]' });
    });

    const result = await fetchStopETAs('95');
    
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].etaSource).toBe('interpolated');
    expect(result[0].minutesArrive).toBeGreaterThan(0);
  });
});

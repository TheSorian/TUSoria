import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchStopETAs } from '../src/services/avanzaApi.js';
import { clearBusState, updateBusState } from '../src/services/etaEngine.js';

describe('Realtime + ETA Integration (Fase 1.3c)', () => {
  beforeEach(() => {
    clearBusState();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 5, 1, 10, 0, 0)); // 10:00 AM (service hours)
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

  it('1. Direct ETA available -> returns direct (REAL)', async () => {
    global.fetch.mockResolvedValueOnce(mockResponse({
      jsontraffics2: JSON.stringify([{
        desLocalCompany: 'Soria',
        desBusLine: 'L1',
        idBusSAE: '001',
        idBus: '101',
        minutesArrive: 4
      }])
    }));

    const results = await fetchStopETAs('1');
    expect(results).toHaveLength(1);
    expect(results[0].etaSource).toBe('direct');
    expect(results[0].minutesArrive).toBe(4);
    expect(results[0].isLive).toBe(true);
  });

  it('2. Direct ETA empty + upstream anchor available -> returns interpolated (INTERPOLATED)', async () => {
    global.fetch.mockImplementation(async (url) => {
      const u = new URL(url, 'http://localhost');
      const stopId = u.searchParams.get('stopId');
      
      // Target stop 11 has preceding stop 1 on L1
      if (stopId === '11') {
        return mockResponse({ jsontraffics2: '[]' });
      }
      if (stopId === '1') {
        return mockResponse({
          jsontraffics2: JSON.stringify([{
            desLocalCompany: 'Soria',
            desBusLine: 'L1',
            idBusSAE: '001',
            minutesArrive: 3
          }])
        });
      }
      return mockResponse({ jsontraffics2: '[]' });
    });

    const results = await fetchStopETAs('11');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].etaSource).toBe('interpolated');
    expect(results[0].minutesArrive).toBeGreaterThanOrEqual(3);
  });

  it('3. Blacklisted stop (#21) falls back to upstream anchor (#104) -> returns interpolated', async () => {
    global.fetch.mockImplementation(async (url) => {
      const u = new URL(url, 'http://localhost');
      const stopId = u.searchParams.get('stopId');
      
      if (stopId === '21') {
        return mockResponse({ jsontraffics2: '[]' });
      }
      // Stop 104 is valid non-blacklisted upstream anchor
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

    const results = await fetchStopETAs('21');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].etaSource).toBe('interpolated');
  });

  it('4. Direct empty + anchor search empty + liveBuses provided -> returns gps (GPS)', async () => {
    global.fetch.mockResolvedValue(mockResponse({ jsontraffics2: '[]' }));

    const liveBuses = [{
      id: 'BUS-102',
      rawId: '102',
      line: 'L1',
      lat: 41.7639,
      lng: -2.4690, // Near stop 1
      minutes: 5,
      sourceHubId: '1',
      isLive: true
    }];

    const results = await fetchStopETAs('11', { liveBuses });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].etaSource).toBe('gps');
    expect(results[0].isLive).toBe(true);
  });

  it('5. Dead snapshot (> 120s / empty liveBuses) + no real-time data -> returns scheduled', async () => {
    global.fetch.mockResolvedValue(mockResponse({ jsontraffics2: '[]' }));

    // When snapshot is dead, caller passes liveBuses: []
    const results = await fetchStopETAs('1', { liveBuses: [] });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].etaSource).toBe('scheduled');
    expect(results[0].isLive).toBe(false);
  });

  it('6. Upstream anchor search timeout (3.5s) falls back gracefully to GPS / Scheduled', async () => {
    global.fetch.mockImplementation(async () => {
      vi.advanceTimersByTime(4000); // Exceed GLOBAL_TIMEOUT_MS
      return mockResponse({ jsontraffics2: '[]' });
    });

    const liveBuses = [{
      id: 'BUS-102',
      rawId: '102',
      line: 'L1',
      lat: 41.7639,
      lng: -2.4690,
      minutes: 5,
      sourceHubId: '1',
      isLive: true
    }];

    const results = await fetchStopETAs('11', { liveBuses });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].etaSource).toBe('gps');
  });

  it('7. Network regression: stop query never calls /api/eta with 7 hub cascade', async () => {
    global.fetch.mockResolvedValue(mockResponse({ jsontraffics2: '[]' }));

    await fetchStopETAs('3');
    
    // Stop queries only query the stop itself + upstream topology (up to 6 max), never all 7 hubs
    const queriedStopIds = global.fetch.mock.calls.map(c => new URL(c[0], 'http://localhost').searchParams.get('stopId'));
    expect(queriedStopIds.length).toBeLessThanOrEqual(7);
  });

  it('8. Circular line wrap-around handles repeated stop instances without collisions', async () => {
    updateBusState('L1_BUS', 15, 41.7, -2.4);

    global.fetch.mockImplementation(async (url) => {
      const u = new URL(url, 'http://localhost');
      const stopId = u.searchParams.get('stopId');
      if (stopId === '1') return mockResponse({ jsontraffics2: '[]' });
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

    const results = await fetchStopETAs('1');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].etaSource).toBe('interpolated');
  });
});

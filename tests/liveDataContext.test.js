import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as avanzaApi from '../src/services/avanzaApi.js';

describe('LiveDataContext - Promise Locking & Caching Logic', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('deduplicates simultaneous in-flight calls to getStopETAs (Promise Locking)', async () => {
    let callCount = 0;
    vi.spyOn(avanzaApi, 'fetchStopETAs').mockImplementation(async () => {
      callCount++;
      return [{
        idBusLine: '001',
        desBusLine: 'L1',
        minutesArrive: 5,
        etaSource: 'direct',
        isLive: true
      }];
    });

    const etasCache = {};
    const pendingEtas = {};
    const ETA_CACHE_TTL_MS = 15000;

    async function getStopETAs(stopId, liveBuses = []) {
      const key = String(stopId);
      const now = Date.now();

      if (etasCache[key] && (now - etasCache[key].timestamp < ETA_CACHE_TTL_MS)) {
        return etasCache[key].data;
      }

      if (pendingEtas[key]) {
        return pendingEtas[key];
      }

      const fetchPromise = (async () => {
        try {
          const data = await avanzaApi.fetchStopETAs(key, { liveBuses });
          etasCache[key] = { data, timestamp: Date.now() };
          return data;
        } finally {
          delete pendingEtas[key];
        }
      })();

      pendingEtas[key] = fetchPromise;
      return fetchPromise;
    }

    const p1 = getStopETAs('1');
    const p2 = getStopETAs('1');

    const [res1, res2] = await Promise.all([p1, p2]);

    expect(callCount).toBe(1);
    expect(res1).toEqual(res2);
    expect(res1[0].minutesArrive).toBe(5);
  });

  it('reuses cache if called within 15 seconds', async () => {
    let callCount = 0;
    vi.spyOn(avanzaApi, 'fetchStopETAs').mockImplementation(async () => {
      callCount++;
      return [{
        idBusLine: '001',
        desBusLine: 'L1',
        minutesArrive: 3,
        etaSource: 'direct',
        isLive: true
      }];
    });

    const etasCache = {};
    const pendingEtas = {};
    const ETA_CACHE_TTL_MS = 15000;

    async function getStopETAs(stopId, liveBuses = []) {
      const key = String(stopId);
      const now = Date.now();

      if (etasCache[key] && (now - etasCache[key].timestamp < ETA_CACHE_TTL_MS)) {
        return etasCache[key].data;
      }

      if (pendingEtas[key]) {
        return pendingEtas[key];
      }

      const fetchPromise = (async () => {
        try {
          const data = await avanzaApi.fetchStopETAs(key, { liveBuses });
          etasCache[key] = { data, timestamp: Date.now() };
          return data;
        } finally {
          delete pendingEtas[key];
        }
      })();

      pendingEtas[key] = fetchPromise;
      return fetchPromise;
    }

    const res1 = await getStopETAs('2');
    expect(callCount).toBe(1);

    // Advance 5 seconds (< 15s TTL)
    vi.advanceTimersByTime(5000);

    const res2 = await getStopETAs('2');
    expect(callCount).toBe(1);
    expect(res2).toEqual(res1);

    // Advance past 15 seconds (> 15s TTL)
    vi.advanceTimersByTime(16000);

    const res3 = await getStopETAs('2');
    expect(callCount).toBe(2);
    expect(res3).toEqual(res1);
  });
});

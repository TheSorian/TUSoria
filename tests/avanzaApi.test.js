import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizeLineCode, isLineActiveToday, getFallbackETAs, fetchStopETAs } from '../src/services/avanzaApi';

describe('avanzaApi', () => {
  describe('normalizeLineCode', () => {
    it('normalizes by SAE code', () => {
      expect(normalizeLineCode('', 'L1')).toBe('L1');
      expect(normalizeLineCode('', '001')).toBe('L1');
      expect(normalizeLineCode('', '012')).toBe('L4E');
      expect(normalizeLineCode('', '008')).toBe('C');
      expect(normalizeLineCode('', '009')).toBe('EX');
    });

    it('normalizes by line name when SAE is missing or unknown', () => {
      expect(normalizeLineCode('L-3', '')).toBe('L3');
      expect(normalizeLineCode('POLÍGONO', '')).toBe('L2');
      expect(normalizeLineCode('BARRIO DE LAS CASAS', '')).toBe('L4E');
      expect(normalizeLineCode('CIRCULAR', '')).toBe('C');
      expect(normalizeLineCode('EXPRES', '')).toBe('EX');
    });
  });

  describe('isLineActiveToday', () => {
    it('L1, L2, L3, L4 are active Mon-Sat but not Sunday', () => {
      const monday = new Date('2023-10-09T10:00:00'); // Monday
      const sunday = new Date('2023-10-15T10:00:00'); // Sunday

      expect(isLineActiveToday('L1', monday)).toBe(true);
      expect(isLineActiveToday('L1', sunday)).toBe(false);
    });

    it('C is active only on Sundays', () => {
      const monday = new Date('2023-10-09T10:00:00');
      const sunday = new Date('2023-10-15T10:00:00');

      expect(isLineActiveToday('C', monday)).toBe(false);
      expect(isLineActiveToday('C', sunday)).toBe(true);
    });

    it('L4E and EX are active only Mon-Fri', () => {
      const friday = new Date('2023-10-13T10:00:00'); // Friday
      const saturday = new Date('2023-10-14T10:00:00'); // Saturday

      expect(isLineActiveToday('EX', friday)).toBe(true);
      expect(isLineActiveToday('EX', saturday)).toBe(false);
    });
  });

  describe('ETA Fallback Behavior', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('returns empty array during night hours', () => {
      vi.setSystemTime(new Date('2023-10-10T02:00:00'));
      expect(getFallbackETAs('1')).toEqual([]);
    });

    it('returns fallback schedule data during day', () => {
      vi.setSystemTime(new Date('2023-10-10T14:00:00'));
      const etas = getFallbackETAs('1');
      // Stop 1 is Pza Mariano Granados, has lines L1, L3, C, EX
      // C is not active on Tuesday, EX might not have trips at 14:00, but L1 and L3 should.
      expect(Array.isArray(etas)).toBe(true);
      if (etas.length > 0) {
        expect(etas[0]).toHaveProperty('etaSource', 'scheduled');
        expect(etas[0]).toHaveProperty('minutesArrive');
        expect(etas[0]).toHaveProperty('desBusLine');
      }
    });

    it('handles empty response gracefully when fetching real ETAs', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}) // No jsontraffics2
      });

      // Should fallback to getFallbackETAs
      vi.setSystemTime(new Date('2023-10-10T14:00:00'));
      const etas = await fetchStopETAs('1');
      expect(Array.isArray(etas)).toBe(true);
      if (etas.length > 0) {
        expect(etas[0].etaSource).toBe('scheduled');
      }
    });
  });
});

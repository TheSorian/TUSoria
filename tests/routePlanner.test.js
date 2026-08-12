import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateDistanceMeters, getNextDepartureInfo } from '../src/services/routePlanner';
import * as avanzaApi from '../src/services/avanzaApi';

// Mock avanzaApi since we shouldn't do real requests in tests
vi.mock('../src/services/avanzaApi', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchStopETAs: vi.fn(),
  };
});

describe('routePlanner', () => {
  describe('calculateDistanceMeters', () => {
    it('calculates distance correctly between two points', () => {
      // Plaza Mariano Granados
      const lat1 = 41.7638;
      const lon1 = -2.4687;
      // Hospital Santa Bárbara
      const lat2 = 41.7588;
      const lon2 = -2.4721;
      
      const dist = calculateDistanceMeters(lat1, lon1, lat2, lon2);
      
      // Real distance is ~620 meters
      expect(dist).toBeGreaterThan(500);
      expect(dist).toBeLessThan(700);
    });

    it('returns 0 for same point', () => {
      expect(calculateDistanceMeters(41.76, -2.46, 41.76, -2.46)).toBe(0);
    });
  });

  describe('getNextDepartureInfo', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.mocked(avanzaApi.fetchStopETAs).mockReset();
    });

    it('returns "Sin servicio hoy" for inactive lines', async () => {
      // Sunday
      vi.setSystemTime(new Date('2023-10-15T10:00:00'));
      const info = await getNextDepartureInfo('L1', '1', 'Plaza Mariano Granados');
      
      expect(info.isRealTime).toBe(false);
      expect(info.timeStr).toBe('Sin servicio hoy');
      expect(info.waitMin).toBe(999);
    });

    it('returns real-time SAE info if available', async () => {
      vi.setSystemTime(new Date('2023-10-10T10:00:00')); // Tuesday
      vi.mocked(avanzaApi.fetchStopETAs).mockResolvedValue([
        { lineCode: 'L1', minutesArrive: 5 }
      ]);

      const info = await getNextDepartureInfo('L1', '1', 'Plaza Mariano Granados');
      
      expect(info.isRealTime).toBe(true);
      expect(info.timeStr).toBe('5 min');
      expect(info.waitMin).toBe(5);
    });

    it('falls back to official schedule if SAE fails or is empty', async () => {
      vi.setSystemTime(new Date('2023-10-10T14:00:00')); // Tuesday
      vi.mocked(avanzaApi.fetchStopETAs).mockResolvedValue([]);

      const info = await getNextDepartureInfo('L1', '1', 'Plaza Mariano Granados');
      
      // According to avanzaSchedules.js, L1 at stop 1 has a trip at 14:15
      expect(info.isRealTime).toBe(false);
      expect(info.timeStr).toBe('14:15');
      expect(info.waitMin).toBe(15);
    });

    it('handles stops with no schedule correctly', async () => {
      vi.setSystemTime(new Date('2023-10-10T14:00:00'));
      vi.mocked(avanzaApi.fetchStopETAs).mockResolvedValue([]);

      // Stop 999 doesn't exist
      const info = await getNextDepartureInfo('L1', '999', 'Fake Stop');
      
      expect(info.isRealTime).toBe(false);
      expect(info.timeStr).toBe('Frecuencia regular');
      expect(info.waitMin).toBe(6);
    });
  });
});

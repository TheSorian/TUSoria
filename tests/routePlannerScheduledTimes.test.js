import { describe, it, expect } from 'vitest';
import { 
  formatMinutesToTimeString, 
  getArrivalTripInfo, 
  planAddressRoute 
} from '../src/services/routePlanner';

describe('Scheduled Route Planning (Depart At & Arrive By)', () => {
  describe('formatMinutesToTimeString', () => {
    it('formats minutes correctly to HH:MM', () => {
      expect(formatMinutesToTimeString(0)).toBe('00:00');
      expect(formatMinutesToTimeString(65)).toBe('01:05');
      expect(formatMinutesToTimeString(630)).toBe('10:30');
      expect(formatMinutesToTimeString(870)).toBe('14:30');
      expect(formatMinutesToTimeString(1439)).toBe('23:59');
    });

    it('handles negative or overflow minutes safely with normalization', () => {
      expect(formatMinutesToTimeString(-10)).toBe('23:50');
      expect(formatMinutesToTimeString(1450)).toBe('00:10');
    });
  });

  describe('getArrivalTripInfo (Backward Scheduling)', () => {
    it('finds the trip that arrives before latestAlightMinutes in L1', () => {
      // In L1: Plaza Mariano Granados (1) -> Hospital Sta Barbara (41)
      // Tuesday
      const tuesday = new Date('2023-10-10T12:00:00');
      const targetArrivalMinutes = 14 * 60 + 30; // 14:30

      const info = getArrivalTripInfo('L1', '1', 'Plaza Mariano Granados', '41', 'Hospital Santa Bárbara', targetArrivalMinutes, tuesday);

      expect(info).not.toBeNull();
      expect(info.alightTripMin).toBeLessThanOrEqual(targetArrivalMinutes);
      expect(info.boardTripMin).toBeLessThan(info.alightTripMin);
      expect(typeof info.boardTimeStr).toBe('string');
      expect(typeof info.alightTimeStr).toBe('string');
    });

    it('returns null on Sunday for weekday-only lines', () => {
      // Sunday
      const sunday = new Date('2023-10-15T12:00:00');
      const info = getArrivalTripInfo('L1', '1', 'Plaza Mariano Granados', '41', 'Hospital Santa Bárbara', 12 * 60, sunday);

      expect(info).toBeNull();
    });
  });

  describe('planAddressRoute with Time Options', () => {
    it('plans forward route with mode: depart_at for future time (10:30)', async () => {
      const tuesday = new Date('2023-10-10T08:00:00');
      const timeOptions = {
        mode: 'depart_at',
        timeStr: '10:30',
        targetDate: tuesday
      };

      const routes = await planAddressRoute(
        'Plaza Mariano Granados',
        'Hospital Santa Bárbara',
        null,
        null,
        timeOptions
      );

      expect(routes.length).toBeGreaterThan(0);
      const direct = routes.find(r => r.transfers === 0);
      expect(direct).toBeDefined();
      expect(direct.timeMode).toBe('depart_at');
      expect(direct.departureTimeFormatted).toBeDefined();
      expect(direct.arrivalTimeFormatted).toBeDefined();
    });

    it('plans backward route with mode: arrive_by (Target: 14:00)', async () => {
      const tuesday = new Date('2023-10-10T08:00:00');
      const timeOptions = {
        mode: 'arrive_by',
        timeStr: '14:00',
        targetDate: tuesday
      };

      const routes = await planAddressRoute(
        'Plaza Mariano Granados',
        'Hospital Santa Bárbara',
        null,
        null,
        timeOptions
      );

      expect(routes.length).toBeGreaterThan(0);
      const r = routes[0];
      expect(r.timeMode).toBe('arrive_by');
      expect(r.targetTimeStr).toBe('14:00');
      
      // Arrival must be at or before 14:00 (or very close to it)
      const [arrH, arrM] = r.arrivalTimeFormatted.split(':').map(Number);
      const arrMin = arrH * 60 + arrM;
      expect(arrMin).toBeLessThanOrEqual(14 * 60);

      // Departure from home must precede arrival
      const [depH, depM] = r.departureTimeFormatted.split(':').map(Number);
      const depMin = depH * 60 + depM;
      expect(depMin).toBeLessThan(arrMin);
    });

    it('handles direct walking when origin and destination are identical or very close', async () => {
      const tuesday = new Date('2023-10-10T08:00:00');
      const timeOptions = {
        mode: 'arrive_by',
        timeStr: '12:00',
        targetDate: tuesday
      };

      const routes = await planAddressRoute(
        { name: 'Punto A', lat: 41.7638, lng: -2.4687 },
        { name: 'Punto B', lat: 41.7639, lng: -2.4688 },
        null,
        null,
        timeOptions
      );

      expect(routes.length).toBe(1);
      expect(routes[0].type).toBe('walk');
      expect(routes[0].timeMode).toBe('arrive_by');
    });
  });
});

import { describe, it, expect } from 'vitest';
import { 
  getStopById, 
  getLineByCode, 
  getLinesForStop, 
  getOrderedStopsForLine, 
  getGeometryForLine 
} from '../src/data/transitNetwork';

describe('Transit Network Model', () => {
  describe('Urban Lines Model', () => {
    it('models urban lines with a single operational direction (no A/B)', () => {
      const line = getLineByCode('L1');
      expect(line).toBeDefined();
      expect(line.serviceType).toBe('full');
      expect(line.directions).toBeUndefined(); // Should not have a directions property
      expect(line.orderedStops).toBeDefined();
      expect(Array.isArray(line.orderedStops)).toBe(true);
      expect(line.orderedStops.length).toBeGreaterThan(0);
      expect(line.geometry).toBeDefined();
    });

    it('returns ordered stops directly for urban lines', () => {
      const stops = getOrderedStopsForLine('L1');
      expect(stops.length).toBeGreaterThan(0);
      expect(stops[0].name).toBeDefined();
    });

    it('returns geometry for all urban lines including C and EX', () => {
      ['L1', 'L2', 'L3', 'L4', 'L4E', 'C', 'EX'].forEach(code => {
        const geom = getGeometryForLine(code);
        expect(geom, `Geometry for ${code} should exist`).toBeDefined();
        expect(geom.length, `Geometry for ${code} should have segments`).toBeGreaterThan(0);
      });
    });
  });

  describe('LC (Camaretas) Model', () => {
    it('models LC as an external schedule-only line with two explicit directions', () => {
      const line = getLineByCode('LC');
      expect(line).toBeDefined();
      expect(line.metadata.provider).toBe('external');
      expect(line.serviceType).toBe('schedule-only');
      expect(line.directions).toBeDefined();
      expect(Object.keys(line.directions)).toHaveLength(2);
      expect(line.directions.camaretasToSoria).toBeDefined();
      expect(line.directions.soriaToCamaretas).toBeDefined();
    });

    it('returns ordered stops for LC only when direction is provided', () => {
      expect(getOrderedStopsForLine('LC')).toEqual([]); // Fails if no direction provided
      expect(getOrderedStopsForLine('LC', 'camaretasToSoria').length).toBeGreaterThan(0);
      expect(getOrderedStopsForLine('LC', 'soriaToCamaretas').length).toBeGreaterThan(0);
    });

    it('handles LC geometry reversal dynamically without duplicating physical array', () => {
      const geomForward = getGeometryForLine('LC', 'camaretasToSoria');
      const geomReverse = getGeometryForLine('LC', 'soriaToCamaretas');
      
      expect(geomForward).toBeDefined();
      expect(geomReverse).toBeDefined();
      expect(geomForward.length).toBe(geomReverse.length); // Same number of segments
      
      // If there are segments, verify the first point of forward is the last point of reverse
      if (geomForward.length > 0) {
        const firstSegmentForward = geomForward[0];
        const lastSegmentReverse = geomReverse[geomReverse.length - 1];
        
        const firstPointForward = firstSegmentForward[0];
        const lastPointReverse = lastSegmentReverse[lastSegmentReverse.length - 1];
        
        expect(firstPointForward).toEqual(lastPointReverse);
      }
    });
  });

  describe('Integrity & Relationships', () => {
    it('returns correct lines for a stop', () => {
      const lines = getLinesForStop('1'); // Plaza Mariano Granados
      const lineCodes = lines.map(l => l.code);
      expect(lineCodes).toContain('L1');
      expect(lineCodes).toContain('L3');
      expect(lineCodes).toContain('C');
      expect(lineCodes).toContain('EX');
    });

    it('returns a stop by ID', () => {
      const stop = getStopById('1');
      expect(stop).toBeDefined();
      expect(stop.name).toContain('Mariano Granados');
    });

    it('returns null for nonexistent stop', () => {
      expect(getStopById('999999')).toBeNull();
    });
  });
});

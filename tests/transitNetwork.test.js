import { describe, it, expect } from 'vitest';
import { 
  getStopById, 
  getLineByCode, 
  getLinesForStop, 
  getDirectionsForLine, 
  getOrderedStopsForLine, 
  getGeometryForLine 
} from '../src/data/transitNetwork';

describe('Transit Network Model', () => {
  describe('Stops', () => {
    it('returns a stop by ID', () => {
      const stop = getStopById('1');
      expect(stop).toBeDefined();
      expect(stop.name).toContain('Mariano Granados');
      expect(stop.lines).toContain('L1');
    });

    it('returns null for nonexistent stop', () => {
      expect(getStopById('999999')).toBeNull();
    });
  });

  describe('Lines', () => {
    it('returns a line by code', () => {
      const line = getLineByCode('L1');
      expect(line).toBeDefined();
      expect(line.metadata.provider).toBe('avanza');
      expect(line.directions.length).toBe(1); // implicit single direction
    });

    it('models LC as an external schedule-only line', () => {
      const line = getLineByCode('LC');
      expect(line).toBeDefined();
      expect(line.metadata.provider).toBe('external');
      expect(line.metadata.serviceType).toBe('schedule-only');
      const dirs = getDirectionsForLine('LC');
      expect(dirs.length).toBe(2); // LC explicitly models two directions
    });
  });

  describe('Relationships', () => {
    it('returns correct lines for a stop', () => {
      const lines = getLinesForStop('1'); // Plaza Mariano Granados
      const lineCodes = lines.map(l => l.code);
      expect(lineCodes).toContain('L1');
      expect(lineCodes).toContain('L3');
      expect(lineCodes).toContain('C');
      expect(lineCodes).toContain('EX');
    });

    it('returns ordered stops for a line', () => {
      const stops = getOrderedStopsForLine('L1', 'default');
      expect(stops.length).toBeGreaterThan(0);
      expect(stops[0].name).toBeDefined();
    });
  });

  describe('Geometries', () => {
    it('returns geometry for L1', () => {
      const geom = getGeometryForLine('L1');
      expect(geom.length).toBe(4); // 4 segments
    });

    it('returns geometry for C and EX', () => {
      // Explicit check to confirm they are not treated as missing geometry
      const geomC = getGeometryForLine('C');
      expect(geomC.length).toBeGreaterThan(0);
      
      const geomEX = getGeometryForLine('EX');
      expect(geomEX.length).toBeGreaterThan(0);
    });

    it('returns geometry for LC', () => {
      const geomLC = getGeometryForLine('LC');
      expect(geomLC.length).toBeGreaterThan(0);
    });
  });
});

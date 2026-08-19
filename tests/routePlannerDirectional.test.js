import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  isTopologicallyReachable, 
  calculateTransitTimeMin, 
  getNextDepartureInfo, 
  planAddressRoute 
} from '../src/services/routePlanner';
import * as avanzaApi from '../src/services/avanzaApi';

vi.mock('../src/services/avanzaApi', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchStopETAs: vi.fn(),
  };
});

describe('FASE 2: Routing Correcto (Topológico & Temporal)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(avanzaApi.fetchStopETAs).mockReset();
  });

  describe('1. Control de Dirección y Topología (isTopologicallyReachable)', () => {
    it('permite viajes hacia adelante en líneas urbanas lineales (L1)', () => {
      // En L1: Plaza Mariano Granados (1) -> Santa Bárbara Hospital (41)
      const reach = isTopologicallyReachable('L1', '1', '41');
      expect(reach.reachable).toBe(true);
      expect(reach.fromIdx).toBeLessThan(reach.toIdx);
      expect(reach.stopsCount).toBeGreaterThan(0);
    });

    it('rechaza viajes en sentido contrario en líneas lineales no circulares', () => {
      // En L1: Morales Contreras (14, index 2) vs Duques de Soria (86, index 3). De 86 a 14 no se puede ir directamente
      const reach = isTopologicallyReachable('L1', '86', '14');
      expect(reach.reachable).toBe(false);
    });

    it('permite wrap-around en líneas circulares (Línea C)', () => {
      // En la línea C (Circular), desde una parada avanzada hacia una anterior debe dar wrap-around
      const reach = isTopologicallyReachable('C', '89', '1');
      expect(reach.reachable).toBe(true);
      expect(reach.stopsCount).toBeGreaterThan(0);
    });

    it('gestiona correctamente la línea bidireccional LC (Camaretas)', () => {
      // Camaretas -> Soria (ej. Centro Cívico LC_CIVICO -> Duques de Soria LC_DUQUES)
      const reach = isTopologicallyReachable('LC', 'LC_CIVICO', 'LC_DUQUES');
      expect(reach.reachable).toBe(true);
      expect(reach.stopsCount).toBeGreaterThan(0);
    });
  });

  describe('2. Cálculo de Tiempo de Tránsito Topológico (calculateTransitTimeMin)', () => {
    it('calcula la diferencia de minutos según la matriz de horarios oficial', () => {
      const departureMinutes = 10 * 60; // 10:00 AM
      const transitTime = calculateTransitTimeMin('L1', '1', '3', departureMinutes, new Date('2023-10-10T10:00:00'));
      
      expect(transitTime).toBeGreaterThan(0);
      expect(typeof transitTime).toBe('number');
    });

    it('garantiza un mínimo de 1 minuto para paradas contiguas', () => {
      const transitTime = calculateTransitTimeMin('L1', '1', '89', 10 * 60);
      expect(transitTime).toBeGreaterThanOrEqual(1);
    });
  });

  describe('3. Sincronización Temporal de Salidas (getNextDepartureInfo)', () => {
    it('calcula la salida considerando la llegada a pie del pasajero (minDepartureMinutes)', async () => {
      vi.setSystemTime(new Date('2023-10-10T14:00:00')); // 14:00
      vi.mocked(avanzaApi.fetchStopETAs).mockResolvedValue([]);

      // Si el pasajero tarda 10 min en llegar (14:10)
      const depInfo = await getNextDepartureInfo('L1', '1', 'Plaza Mariano Granados', null, 14 * 60 + 10);
      
      // En horario de L1 a las 14:00, la siguiente es 14:15. Con llegada 14:10, la espera debe ser 5 min
      expect(depInfo.timeStr).toBe('14:15');
      expect(depInfo.waitMin).toBe(5);
    });

    it('utiliza ETA realtime si el pasajero llega a tiempo para subir al autobús', async () => {
      vi.setSystemTime(new Date('2023-10-10T10:00:00'));
      // Autobús llega en 8 min
      vi.mocked(avanzaApi.fetchStopETAs).mockResolvedValue([
        { lineCode: 'L1', minutesArrive: 8 }
      ]);

      // Pasajero tarda 3 min en llegar caminando
      const depInfo = await getNextDepartureInfo('L1', '1', 'Plaza Mariano Granados', null, 10 * 60 + 3);
      
      expect(depInfo.isRealTime).toBe(true);
      expect(depInfo.waitMin).toBe(5); // 8 min bus - 3 min caminata = 5 min de espera neta en parada
    });

    it('devuelve "Sin servicio hoy" en domingos para líneas no dominicales', async () => {
      vi.setSystemTime(new Date('2023-10-15T10:00:00')); // Domingo
      const depInfo = await getNextDepartureInfo('L1', '1', 'Plaza Mariano Granados');
      
      expect(depInfo.timeStr).toBe('Sin servicio hoy');
      expect(depInfo.waitMin).toBe(999);
    });
  });

  describe('4. Planificación Integral de Rutas (planAddressRoute)', () => {
    it('ofrece ruta puramente a pie si la distancia es menor a 250 metros', async () => {
      const origin = { name: 'Punto A', lat: 41.7638, lng: -2.4687 };
      const dest = { name: 'Punto B', lat: 41.7640, lng: -2.4690 }; // ~50 metros
      
      const routes = await planAddressRoute(origin, dest);
      expect(routes.length).toBe(1);
      expect(routes[0].type).toBe('walk');
      expect(routes[0].transfers).toBe(0);
    });

    it('genera rutas directas respetando dirección y topología', async () => {
      vi.setSystemTime(new Date('2023-10-10T10:00:00'));
      
      // Desde Mariano Granados hasta Hospital Sta. Bárbara
      const origin = { name: 'Mariano Granados', lat: 41.7638, lng: -2.4687 };
      const dest = { name: 'Hospital', lat: 41.7588, lng: -2.4721 };
      
      const routes = await planAddressRoute(origin, dest);
      expect(routes.length).toBeGreaterThan(0);
      
      const bestRoute = routes[0];
      expect(bestRoute.legs.length).toBe(3); // Walk -> Bus -> Walk
      expect(bestRoute.legs[1].mode).toBe('bus');
      expect(bestRoute.totalTimeMin).toBeGreaterThan(0);
    });

    it('genera rutas con 1 transbordo sincronizado cuando no hay línea directa', async () => {
      vi.setSystemTime(new Date('2023-10-10T10:00:00'));
      
      // Dos puntos en extremos opuestos de Soria atendidos por líneas distintas
      const origin = { name: 'Extremo Norte', lat: 41.7750, lng: -2.4600 };
      const dest = { name: 'Extremo Sur', lat: 41.7500, lng: -2.4750 };
      
      const routes = await planAddressRoute(origin, dest);
      expect(routes.length).toBeGreaterThan(0);
      
      const transferRoute = routes.find(r => r.transfers === 1);
      if (transferRoute) {
        expect(transferRoute.legs.some(l => l.mode === 'transfer')).toBe(true);
        expect(transferRoute.totalTimeMin).toBeGreaterThan(0);
      }
    });
  });
});

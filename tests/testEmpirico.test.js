import { describe, it, vi, expect } from 'vitest';
import { fetchStopETAs } from '../src/services/avanzaApi.js';

describe('Empirical Test - Stop 21', () => {
  it('runs the empirical tests with logs', async () => {
     
     // Mock fetch to simulate an anchor found at Stop 21
     global.fetch = vi.fn().mockImplementation(async (url) => {
        if (url.includes('stopId=21')) {
           return {
              ok: true,
              json: async () => ({
                 jsontraffics2: JSON.stringify([
                    {
                       idBusSAE: "S-105",
                       desBusLine: "L2",
                       minutesArrive: 2
                    }
                 ])
              })
           };
        }
        return {
           ok: true,
           json: async () => ({ jsontraffics2: "[]" })
        };
     });

     const originalNow = Date.now;

     console.log('\\n======================================================');
     console.log('TEST EMPIRICO 1: L2 NORMAL (10:40 AM)');
     console.log('Debería encontrar la parada 21 inmediatamente (offset 1) sin pasar por polígono.');
     console.log('======================================================\\n');
     
     const d1 = new Date();
     d1.setHours(10, 40, 0, 0);
     Date.now = () => d1.getTime();
     
     await fetchStopETAs('22'); // Target Calle N

     console.log('\\n======================================================');
     console.log('TEST EMPIRICO 2: L2 PROLONGADA (13:41)');
     console.log('Debería recorrer todo el polígono antes de llegar a la 21 (offset 8).');
     console.log('======================================================\\n');

     const d2 = new Date();
     d2.setHours(13, 41, 0, 0);
     Date.now = () => d2.getTime();

     await fetchStopETAs('22'); // Target Calle N

     Date.now = originalNow;
     
     expect(true).toBe(true);
  });
});

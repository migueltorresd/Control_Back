import { hoyLocal } from './fecha.util';

describe('hoyLocal', () => {
  it('devuelve el formato YYYY-MM-DD', () => {
    expect(hoyLocal()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('corrige el bug de UTC: 9 p.m. en Bogotá sigue siendo el mismo día', () => {
    // 2026-06-12 02:00 UTC = 2026-06-11 21:00 en Bogotá (UTC-5)
    const instante = new Date('2026-06-12T02:00:00Z');
    expect(hoyLocal('America/Bogota', instante)).toBe('2026-06-11');
    // Con UTC daría '2026-06-12' (el bug que se corrige)
    expect(instante.toISOString().split('T')[0]).toBe('2026-06-12');
  });

  it('respeta la zona horaria indicada', () => {
    const instante = new Date('2026-06-12T02:00:00Z');
    expect(hoyLocal('UTC', instante)).toBe('2026-06-12');
  });
});

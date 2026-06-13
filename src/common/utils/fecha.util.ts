/**
 * Fecha "de hoy" en formato YYYY-MM-DD según la zona horaria del negocio.
 *
 * Evita el bug de usar `new Date().toISOString().split('T')[0]`, que devuelve
 * la fecha en UTC: en Colombia (UTC-5), después de las 7 p.m. eso daría el
 * día siguiente, fechando mal pagos y ventas.
 *
 * La zona se toma de `BUSINESS_TZ` (default America/Bogota). El parámetro
 * `ahora` permite fijar el instante en los tests.
 */
export function hoyLocal(
  timeZone: string = process.env.BUSINESS_TZ ?? 'America/Bogota',
  ahora: Date = new Date(),
): string {
  // 'en-CA' produce el formato YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora);
}

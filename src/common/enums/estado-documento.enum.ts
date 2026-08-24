/**
 * Ciclo de vida de un documento de salida: venta o remisión.
 *
 * Ninguno se elimina, se anula. Borrar la fila devolvería el stock igual —el
 * conteo de vendidos deja de sumarla— pero se llevaría por delante la única
 * evidencia de que esa mercancía salió: cuántos pares, a qué precio, qué día y
 * bajo qué documento. Con una remisión firmada por el cliente eso es peor
 * todavía: queda un papel entregado sin respaldo en el sistema.
 *
 * La anulación devuelve el stock igual, y además deja quién, cuándo y por qué.
 *
 * Espeja los mismos valores que `EstadoVale`, en tabla aparte porque son
 * entidades distintas y sus ciclos pueden divergir.
 */
export enum EstadoDocumento {
  ACTIVO = 'activo',
  ANULADO = 'anulado',
}

/**
 * Ciclo de vida del vale. Un vale NUNCA se elimina: se anula.
 *
 * Borrarlo dejaría huérfanos los registros de producción, los rechazos y los
 * pagos que cuelgan de él, y borraría la única evidencia de que ese trabajo
 * existió. La anulación conserva todo y deja el rastro de quién la hizo.
 */
export enum EstadoVale {
  ACTIVO = 'activo',
  ANULADO = 'anulado',
}

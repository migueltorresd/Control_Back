/**
 * Cómo llegó la plata de un abono.
 *
 * No reusa `FormaPago` a propósito: esa incluye `CREDITO`, y un abono pagado
 * "a crédito" no significa nada —sería registrar que la deuda se pagó con más
 * deuda—. Un enum que solo admite valores posibles evita tener que validar
 * después lo que el tipo ya podría haber impedido.
 */
export enum MetodoAbono {
  EFECTIVO = 'EFECTIVO',
  TRANSFERENCIA = 'TRANSFERENCIA',
}

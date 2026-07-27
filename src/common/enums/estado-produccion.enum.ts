export enum EstadoProduccion {
  /**
   * Solo se sabe QUIÉN hace la etapa; la cantidad se carga al cierre de semana.
   * No consume cupo del vale ni puede aprobarse o pagarse hasta tener pares.
   */
  ASIGNADO = 'asignado',
  REGISTRADO = 'registrado',
  APROBADO = 'aprobado',
  PAGADO = 'pagado',
}

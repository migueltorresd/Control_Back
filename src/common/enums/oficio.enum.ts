export enum Oficio {
  CORTADOR = 'Cortador',
  GUARNECEDOR = 'Guarnecedor',
  SOLADOR = 'Solador',
  FINIZAJE = 'Finizaje',
}

/**
 * Las etapas en el orden real en que el zapato recorre el taller.
 *
 * El orden importa y no es el alfabético ni el de declaración por casualidad:
 * de acá sale cuál es la última, y por lo tanto qué significa "terminado".
 */
export const ETAPAS_EN_ORDEN: readonly Oficio[] = [
  Oficio.CORTADOR,
  Oficio.GUARNECEDOR,
  Oficio.SOLADOR,
  Oficio.FINIZAJE,
];

/**
 * Última etapa de la línea: un par está FABRICADO cuando sale de acá.
 *
 * Se deriva del orden en vez de escribirse a mano, igual que en el frontend
 * (`ULTIMA_ETAPA` en src/constants): si mañana se agrega una etapa al final,
 * "fabricado" pasa a significar lo nuevo sin tocar ningún cálculo.
 */
export const ULTIMA_ETAPA = ETAPAS_EN_ORDEN[ETAPAS_EN_ORDEN.length - 1];

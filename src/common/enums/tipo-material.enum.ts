/**
 * Etapa del taller que consume el material.
 *
 * Los cuatro primeros valores son, uno a uno, los oficios de `Oficio`: un
 * material de corte es el que gasta el cortador, uno de guarnición el que gasta
 * el guarnecedor, y así. `OTROS` cubre lo transversal (cajas, etiquetas, hilo
 * de uso general) que no pertenece a ninguna etapa en particular.
 *
 * Los valores son slugs ASCII en mayúscula, no las etiquetas que ve el usuario.
 * Viajan como query param (`?tipo=GUARNICION`) y comparar acentos a través de
 * una URL es una fuente de bugs que no vale la pena pagar. La etiqueta bonita
 * ("Material de guarnición") la arma el frontend.
 */
export enum TipoMaterial {
  CORTE = 'CORTE',
  GUARNICION = 'GUARNICION',
  SOLADURA = 'SOLADURA',
  FINIZAJE = 'FINIZAJE',
  OTROS = 'OTROS',
}

/**
 * Cómo paga el cliente la mercancía que se le remite.
 *
 * Son las tres únicas casillas del talonario de papel, y se respetan tal cual:
 * el vendedor marca lo mismo en la app que en el bloc.
 *
 * `CREDITO` no dice nada sobre si ya se cobró: solo que la mercancía salió sin
 * plata de por medio. El seguimiento de la cobranza, si se necesita, es otra
 * historia y no vive acá.
 *
 * Los valores son slugs ASCII en mayúscula, no las etiquetas que ve el usuario:
 * viajan por la URL y comparar acentos a través de una query es una fuente de
 * bugs que no vale la pena pagar. La etiqueta bonita la arma el frontend.
 */
export enum FormaPago {
  EFECTIVO = 'EFECTIVO',
  TRANSFERENCIA = 'TRANSFERENCIA',
  CREDITO = 'CREDITO',
}

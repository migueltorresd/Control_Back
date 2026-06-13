import { ValueTransformer } from 'typeorm';

/**
 * Convierte las columnas `numeric`/`decimal` de PostgreSQL (que el driver pg
 * devuelve como string para no perder precisión) a `number` en la app.
 *
 * Política de redondeo: las columnas de dinero usan `numeric(12,2)` — la BD
 * trunca/redondea a 2 decimales al persistir. La app no redondea en el `to`,
 * confía en la escala de la columna. Si un cálculo produce más de 2 decimales,
 * redondear explícitamente (`Math.round(x * 100) / 100`) antes de guardar.
 */
export const decimalTransformer: ValueTransformer = {
  to: (value: number | null): number | null => value,
  from: (value: string | null): number | null =>
    value === null || value === undefined ? null : parseFloat(value),
};

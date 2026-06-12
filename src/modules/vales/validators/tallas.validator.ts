import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

const TALLA_MIN = 15;
const TALLA_MAX = 60;

/**
 * Valida el objeto de tallas { "38": 5, ... }:
 * - objeto no vacío
 * - claves: enteros entre 15 y 60 (rango razonable de tallas de calzado)
 * - valores: enteros positivos
 * El shape Record<string, number> se mantiene tal como lo envía el frontend.
 */
@ValidatorConstraint({ name: 'tallasValidas', async: false })
export class TallasValidator implements ValidatorConstraintInterface {
  private error = 'Las tallas no son válidas';

  validate(value: unknown): boolean {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      this.error = 'Las tallas deben ser un objeto clave-valor (ej. {"38": 5})';
      return false;
    }

    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      this.error = 'Debes indicar al menos una talla con su cantidad';
      return false;
    }

    for (const [talla, cantidad] of entries) {
      const tallaNum = Number(talla);
      if (!Number.isInteger(tallaNum)) {
        this.error = `La talla "${talla}" no es válida: debe ser un número entero`;
        return false;
      }
      if (tallaNum < TALLA_MIN || tallaNum > TALLA_MAX) {
        this.error = `La talla ${talla} está fuera del rango permitido (${TALLA_MIN} a ${TALLA_MAX})`;
        return false;
      }
      if (typeof cantidad !== 'number' || !Number.isInteger(cantidad)) {
        this.error = `La cantidad de la talla ${talla} debe ser un número entero`;
        return false;
      }
      if (cantidad <= 0) {
        this.error = `La cantidad de la talla ${talla} debe ser mayor a 0`;
        return false;
      }
    }

    return true;
  }

  defaultMessage(): string {
    return this.error;
  }
}

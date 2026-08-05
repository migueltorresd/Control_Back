import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TipoMaterial } from '../../../common/enums/tipo-material.enum';

/**
 * Sentinela para pedir los materiales que todavía nadie clasificó.
 * No es un `TipoMaterial`: representa la ausencia de tipo (`tipo IS NULL`),
 * y es la consulta que más se usa mientras el taller termina de clasificar
 * el catálogo que ya tenía cargado.
 */
export const SIN_CLASIFICAR = 'SIN_CLASIFICAR';

const TIPOS_FILTRABLES: string[] = [
  ...Object.values(TipoMaterial),
  SIN_CLASIFICAR,
];

/**
 * Query de materiales. No hereda de `PaginationQueryDto` a propósito: aquel
 * trae `desde`/`hasta`, y `materiales` no tiene ninguna columna de fecha por la
 * cual filtrar. Declararlos acá sería aceptar parámetros que no hacen nada.
 *
 * La paginación es opt-in, igual que en vales, ventas y pagos: sin `page` ni
 * `limit` la respuesta sigue siendo el array plano de siempre. Eso es lo que
 * mantiene vivo al frontend actual, que carga el catálogo entero para calcular
 * costos y armar las recetas.
 */
export class MaterialesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page debe ser un número entero' })
  @Min(1, { message: 'page debe ser mayor o igual a 1' })
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit debe ser un número entero' })
  @Min(1, { message: 'limit debe ser mayor o igual a 1' })
  @Max(200, { message: 'limit no puede ser mayor a 200' })
  limit?: number;

  @IsOptional()
  @IsIn(TIPOS_FILTRABLES, {
    message: `El tipo debe ser uno de: ${TIPOS_FILTRABLES.join(', ')}`,
  })
  tipo?: TipoMaterial | typeof SIN_CLASIFICAR;

  /** Búsqueda parcial e insensible a mayúsculas sobre nombre y proveedor. */
  @IsOptional()
  @IsString({ message: 'q debe ser un texto' })
  @MaxLength(80, { message: 'q no puede superar los 80 caracteres' })
  q?: string;

  /** True solo si el cliente pidió el envelope paginado explícitamente. */
  get esPaginado(): boolean {
    return this.page !== undefined || this.limit !== undefined;
  }
}

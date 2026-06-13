import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min, Max, IsDateString } from 'class-validator';

/**
 * Query de paginación opt-in. Si no llega ningún campo, el endpoint
 * devuelve la lista completa (modo legacy, usado por las agregaciones
 * del frontend). Si llega cualquiera, responde el envelope paginado.
 */
export class PaginationQueryDto {
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
  @IsDateString({}, { message: 'desde debe ser una fecha válida (YYYY-MM-DD)' })
  desde?: string;

  @IsOptional()
  @IsDateString({}, { message: 'hasta debe ser una fecha válida (YYYY-MM-DD)' })
  hasta?: string;

  /** True si el cliente pidió paginación/filtrado explícito. */
  get esPaginado(): boolean {
    return (
      this.page !== undefined ||
      this.limit !== undefined ||
      this.desde !== undefined ||
      this.hasta !== undefined
    );
  }
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

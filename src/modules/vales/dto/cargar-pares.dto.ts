import { IsNotEmpty, IsInt, IsPositive } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Cierre de una asignación: al final de la semana se sabe cuántos pares hizo
 * el operario y el registro pasa de ASIGNADO a REGISTRADO.
 */
export class CargarParesDto {
  @ApiProperty({
    description: 'Cantidad de pares que hizo el operario',
    example: 12,
  })
  @IsNotEmpty({ message: 'La cantidad de pares es requerida' })
  @IsInt({ message: 'La cantidad de pares debe ser un número entero' })
  @IsPositive({ message: 'La cantidad de pares debe ser mayor a 0' })
  pares: number;
}

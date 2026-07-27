import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsInt,
  IsPositive,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Oficio } from '../../../common/enums/oficio.enum';

export class RegisterProduccionDto {
  @ApiProperty({
    description: 'Etapa u oficio de la producción a registrar',
    enum: Oficio,
    example: 'Cortador',
  })
  @IsNotEmpty({ message: 'La etapa (oficio) es requerida' })
  @IsEnum(Oficio, {
    message:
      'La etapa debe ser un oficio válido (Cortador, Guarnecedor, Solador, Finizaje)',
  })
  etapa: Oficio;

  @ApiProperty({
    description: 'ID del operario que realiza la producción',
    example: 'OP-01',
  })
  @IsNotEmpty({ message: 'El ID del operario es requerido' })
  @IsString({ message: 'El ID del operario debe ser un texto' })
  operarioId: string;

  @ApiPropertyOptional({
    description:
      'Cantidad de pares producidos. Si se omite, el registro queda solo ASIGNADO: ' +
      'no consume cupo del vale y no puede aprobarse ni pagarse hasta cargar la cantidad.',
    example: 4,
  })
  @IsOptional()
  @IsInt({ message: 'La cantidad de pares debe ser un número entero' })
  @IsPositive({ message: 'La cantidad de pares debe ser mayor a 0' })
  pares?: number;
}

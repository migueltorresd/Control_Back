import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsInt,
  IsPositive,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
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

  @ApiProperty({ description: 'Cantidad de pares producidos', example: 4 })
  @IsNotEmpty({ message: 'La cantidad de pares es requerida' })
  @IsInt({ message: 'La cantidad de pares debe ser un número entero' })
  @IsPositive({ message: 'La cantidad de pares debe ser mayor a 0' })
  pares: number;
}

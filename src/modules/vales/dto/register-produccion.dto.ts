import { IsNotEmpty, IsString, IsEnum, IsInt, IsPositive } from 'class-validator';
import { Oficio } from '../../../common/enums/oficio.enum';

export class RegisterProduccionDto {
  @IsNotEmpty({ message: 'La etapa (oficio) es requerida' })
  @IsEnum(Oficio, { message: 'La etapa debe ser un oficio válido (Cortador, Guarnecedor, Solador, Finizaje)' })
  etapa: Oficio;

  @IsNotEmpty({ message: 'El ID del operario es requerido' })
  @IsString({ message: 'El ID del operario debe ser un texto' })
  operarioId: string;

  @IsNotEmpty({ message: 'La cantidad de pares es requerida' })
  @IsInt({ message: 'La cantidad de pares debe ser un número entero' })
  @IsPositive({ message: 'La cantidad de pares debe ser mayor a 0' })
  pares: number;
}

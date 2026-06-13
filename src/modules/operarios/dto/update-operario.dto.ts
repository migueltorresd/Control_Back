import { IsOptional, IsString, IsEnum, IsInt, Min } from 'class-validator';
import { Oficio } from '../../../common/enums/oficio.enum';

export class UpdateOperarioDto {
  @IsOptional()
  @IsString({ message: 'El nombre debe ser un texto' })
  nombre?: string;

  @IsOptional()
  @IsEnum(Oficio, {
    message:
      'El oficio debe ser un valor válido (Cortador, Guarnecedor, Solador, Finizaje)',
  })
  oficio?: Oficio;

  @IsOptional()
  @IsInt({ message: 'La antigüedad debe ser un número entero' })
  @Min(0, { message: 'La antigüedad no puede ser negativa' })
  antiguedad?: number;
}

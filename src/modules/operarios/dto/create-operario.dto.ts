import { IsNotEmpty, IsString, IsEnum, IsInt, Min, IsOptional } from 'class-validator';
import { Oficio } from '../../../common/enums/oficio.enum';

export class CreateOperarioDto {
  @IsOptional()
  @IsString({ message: 'El ID debe ser un texto' })
  id?: string;

  @IsNotEmpty({ message: 'El nombre es requerido' })
  @IsString({ message: 'El nombre debe ser un texto' })
  nombre: string;

  @IsNotEmpty({ message: 'El oficio es requerido' })
  @IsEnum(Oficio, { message: 'El oficio debe ser un valor válido (Cortador, Guarnecedor, Solador, Finizaje)' })
  oficio: Oficio;

  @IsOptional()
  @IsInt({ message: 'La antigüedad debe ser un número entero' })
  @Min(0, { message: 'La antigüedad no puede ser negativa' })
  antiguedad?: number;
}

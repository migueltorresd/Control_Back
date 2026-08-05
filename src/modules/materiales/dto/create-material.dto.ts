import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsPositive,
  IsOptional,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { TipoMaterial } from '../../../common/enums/tipo-material.enum';

export class CreateMaterialDto {
  @IsOptional()
  @IsString({ message: 'El ID debe ser un texto' })
  id?: string;

  @IsNotEmpty({ message: 'El nombre es requerido' })
  @IsString({ message: 'El nombre debe ser un texto' })
  nombre: string;

  @IsOptional()
  @IsString({ message: 'El proveedor debe ser un texto' })
  proveedor?: string;

  /**
   * Texto libre a propósito. Cada taller nombra sus unidades como las nombra
   * ("PAR", "DECIMETRO", "Metro") y la base ya está llena con esas palabras.
   * Una lista blanca acá rechazaba los datos que el propio sistema guardó.
   */
  @IsNotEmpty({ message: 'La unidad de medida es requerida' })
  @IsString({ message: 'La unidad de medida debe ser un texto' })
  @MaxLength(30, {
    message: 'La unidad no puede superar los 30 caracteres',
  })
  unidad: string;

  /** Opcional: los materiales viejos no tienen tipo hasta que alguien los clasifique. */
  @IsOptional()
  @IsEnum(TipoMaterial, {
    message:
      'El tipo debe ser uno de: CORTE, GUARNICION, SOLADURA, FINIZAJE, OTROS',
  })
  tipo?: TipoMaterial;

  @IsNotEmpty({ message: 'El precio es requerido' })
  @IsNumber({}, { message: 'El precio debe ser un número' })
  @IsPositive({ message: 'El precio debe ser un número positivo' })
  precio: number;
}

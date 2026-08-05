import {
  IsOptional,
  IsString,
  IsNumber,
  IsPositive,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { TipoMaterial } from '../../../common/enums/tipo-material.enum';

export class UpdateMaterialDto {
  @IsOptional()
  @IsString({ message: 'El nombre debe ser un texto' })
  nombre?: string;

  @IsOptional()
  @IsString({ message: 'El proveedor debe ser un texto' })
  proveedor?: string;

  /** Texto libre: ver la nota en `CreateMaterialDto`. */
  @IsOptional()
  @IsString({ message: 'La unidad de medida debe ser un texto' })
  @MaxLength(30, {
    message: 'La unidad no puede superar los 30 caracteres',
  })
  unidad?: string;

  @IsOptional()
  @IsEnum(TipoMaterial, {
    message:
      'El tipo debe ser uno de: CORTE, GUARNICION, SOLADURA, FINIZAJE, OTROS',
  })
  tipo?: TipoMaterial;

  @IsOptional()
  @IsNumber({}, { message: 'El precio debe ser un número' })
  @IsPositive({ message: 'El precio debe ser un número positivo' })
  precio?: number;
}

import {
  IsOptional,
  IsString,
  IsNumber,
  IsPositive,
  IsIn,
} from 'class-validator';

export class UpdateMaterialDto {
  @IsOptional()
  @IsString({ message: 'El nombre debe ser un texto' })
  nombre?: string;

  @IsOptional()
  @IsString({ message: 'El proveedor debe ser un texto' })
  proveedor?: string;

  @IsOptional()
  @IsString({ message: 'La unidad de medida debe ser un texto' })
  @IsIn(['pie²', 'par', 'kg', 'unidad'], {
    message: 'La unidad debe ser una de: pie², par, kg, unidad',
  })
  unidad?: string;

  @IsOptional()
  @IsNumber({}, { message: 'El precio debe ser un número' })
  @IsPositive({ message: 'El precio debe ser un número positivo' })
  precio?: number;
}

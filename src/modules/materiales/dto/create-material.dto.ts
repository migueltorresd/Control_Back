import { IsNotEmpty, IsString, IsNumber, IsPositive, IsOptional, IsIn } from 'class-validator';

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

  @IsNotEmpty({ message: 'La unidad de medida es requerida' })
  @IsString({ message: 'La unidad de medida debe ser un texto' })
  @IsIn(['pie²', 'par', 'kg', 'unidad'], { message: 'La unidad debe ser una de: pie², par, kg, unidad' })
  unidad: string;

  @IsNotEmpty({ message: 'El precio es requerido' })
  @IsNumber({}, { message: 'El precio debe ser un número' })
  @IsPositive({ message: 'El precio debe ser un número positivo' })
  precio: number;
}

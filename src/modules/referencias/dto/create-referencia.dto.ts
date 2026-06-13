import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  ValidateNested,
  IsEnum,
  Min,
  IsArray,
  IsPositive,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Oficio } from '../../../common/enums/oficio.enum';

export class TarifaItemDto {
  @IsNotEmpty({ message: 'El oficio es requerido' })
  @IsEnum(Oficio, {
    message:
      'El oficio debe ser un valor válido (Cortador, Guarnecedor, Solador, Finizaje)',
  })
  oficio: Oficio;

  @IsNotEmpty({ message: 'El valor de la tarifa es requerido' })
  @IsNumber({}, { message: 'El valor debe ser un número' })
  @Min(0, { message: 'El valor no puede ser negativo' })
  valor: number;
}

export class RecetaItemDto {
  @IsNotEmpty({ message: 'El ID del material es requerido' })
  @IsString({ message: 'El ID del material debe ser un texto' })
  materialId: string;

  @IsNotEmpty({ message: 'La cantidad del material es requerida' })
  @IsNumber({}, { message: 'La cantidad debe ser un número' })
  @IsPositive({ message: 'La cantidad debe ser mayor a 0' })
  cantidad: number;
}

export class CreateReferenciaDto {
  @IsOptional()
  @IsString({ message: 'El ID debe ser un texto' })
  id?: string;

  @IsNotEmpty({ message: 'El nombre es requerido' })
  @IsString({ message: 'El nombre debe ser un texto' })
  nombre: string;

  @IsOptional()
  @IsString({ message: 'La línea debe ser un texto' })
  linea?: string;

  @IsNotEmpty({ message: 'El precio de venta es requerido' })
  @IsNumber({}, { message: 'El precio de venta debe ser un número' })
  @Min(0, { message: 'El precio de venta no puede ser negativo' })
  precioVenta: number;

  @IsNotEmpty({ message: 'Las tarifas son requeridas' })
  @IsArray({ message: 'Las tarifas deben ser un arreglo' })
  @ValidateNested({ each: true })
  @Type(() => TarifaItemDto)
  tarifas: TarifaItemDto[];

  @IsNotEmpty({ message: 'La receta es requerida' })
  @IsArray({ message: 'La receta debe ser un arreglo' })
  @ValidateNested({ each: true })
  @Type(() => RecetaItemDto)
  receta: RecetaItemDto[];
}

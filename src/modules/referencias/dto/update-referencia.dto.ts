import {
  IsString,
  IsNumber,
  IsOptional,
  ValidateNested,
  IsArray,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TarifaItemDto, RecetaItemDto } from './create-referencia.dto';

export class UpdateReferenciaDto {
  @IsOptional()
  @IsString({ message: 'El nombre debe ser un texto' })
  nombre?: string;

  @IsOptional()
  @IsString({ message: 'La línea debe ser un texto' })
  linea?: string;

  @IsOptional()
  @IsNumber({}, { message: 'El precio de venta debe ser un número' })
  @Min(0, { message: 'El precio de venta no puede ser negativo' })
  precioVenta?: number;

  @IsOptional()
  @IsArray({ message: 'Las tarifas deben ser un arreglo' })
  @ValidateNested({ each: true })
  @Type(() => TarifaItemDto)
  tarifas?: TarifaItemDto[];

  @IsOptional()
  @IsArray({ message: 'La receta debe ser un arreglo' })
  @ValidateNested({ each: true })
  @Type(() => RecetaItemDto)
  receta?: RecetaItemDto[];
}

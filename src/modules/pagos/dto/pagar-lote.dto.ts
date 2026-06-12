import { IsNotEmpty, IsArray, ValidateNested, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class PagarLoteItemDto {
  @IsNotEmpty({ message: 'El ID del vale es requerido' })
  @IsString({ message: 'El ID del vale debe ser un texto' })
  vale: string;

  @IsNotEmpty({ message: 'La etapa es requerida' })
  @IsString({ message: 'La etapa debe ser un texto' })
  etapa: string;

  @IsNotEmpty({
    message: 'El ID del registro de producción (regId) es requerido',
  })
  @IsString({ message: 'El ID del registro debe ser un texto' })
  regId: string;
}

export class PagarLoteDto {
  @IsNotEmpty({ message: 'Los ítems a pagar son requeridos' })
  @IsArray({ message: 'Los ítems deben ser un arreglo' })
  @ValidateNested({ each: true })
  @Type(() => PagarLoteItemDto)
  items: PagarLoteItemDto[];
}

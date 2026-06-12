import { IsNotEmpty, IsArray, ValidateNested, IsString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { Oficio } from '../../../common/enums/oficio.enum';

export class PagarLoteItemDto {
  @IsNotEmpty({ message: 'El ID del vale es requerido' })
  @IsString({ message: 'El ID del vale debe ser un texto' })
  vale: string;

  @IsNotEmpty({ message: 'La etapa es requerida' })
  @IsEnum(Oficio, { message: 'La etapa debe ser un oficio válido' })
  etapa: Oficio;

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

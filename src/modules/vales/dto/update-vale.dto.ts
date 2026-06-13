import { IsOptional, IsString, IsDateString, IsObject } from 'class-validator';

export class UpdateValeDto {
  @IsOptional()
  @IsDateString(
    {},
    { message: 'La fecha debe tener un formato válido de fecha (YYYY-MM-DD)' },
  )
  fecha?: string;

  @IsOptional()
  @IsString({ message: 'El almacén debe ser un texto' })
  almacen?: string;

  @IsOptional()
  @IsString({ message: 'El color debe ser un texto' })
  color?: string;

  @IsOptional()
  @IsString({ message: 'La altura debe ser un texto' })
  altura?: string;

  @IsOptional()
  @IsString({ message: 'El ID de la referencia debe ser un texto' })
  referenciaId?: string;

  @IsOptional()
  @IsObject({
    message: 'Las tallas deben ser un objeto clave-valor (ej. {"38": 5})',
  })
  tallas?: Record<string, number>;
}

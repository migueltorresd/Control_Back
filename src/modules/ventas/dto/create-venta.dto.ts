import {
  IsNotEmpty,
  IsString,
  IsInt,
  Min,
  IsNumber,
  IsOptional,
  IsDateString,
} from 'class-validator';

export class CreateVentaDto {
  @IsNotEmpty({ message: 'El ID del vale es requerido' })
  @IsString({ message: 'El ID del vale debe ser un texto' })
  valeId: string;

  @IsNotEmpty({ message: 'La cantidad de pares es requerida' })
  @IsInt({ message: 'La cantidad de pares debe ser un número entero' })
  @Min(1, { message: 'La cantidad de pares debe ser mayor a 0' })
  pares: number;

  @IsNotEmpty({ message: 'El precio unitario es requerido' })
  @IsNumber({}, { message: 'El precio unitario debe ser un número' })
  @Min(0, { message: 'El precio unitario no puede ser negativo' })
  precioUnitario: number;

  @IsOptional()
  @IsDateString(
    {},
    { message: 'La fecha debe tener un formato de fecha válido (YYYY-MM-DD)' },
  )
  fecha?: string;
}

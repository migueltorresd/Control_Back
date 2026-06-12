import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsObject,
  Validate,
} from 'class-validator';
import { TallasValidator } from '../validators/tallas.validator';

export class CreateValeDto {
  @IsOptional()
  @IsString({ message: 'La fecha debe ser un texto con formato YYYY-MM-DD' })
  fecha?: string;

  @IsNotEmpty({ message: 'El almacén es requerido' })
  @IsString({ message: 'El almacén debe ser un texto' })
  almacen: string;

  @IsNotEmpty({ message: 'El color es requerido' })
  @IsString({ message: 'El color debe ser un texto' })
  color: string;

  @IsNotEmpty({ message: 'La altura es requerida' })
  @IsString({ message: 'La altura debe ser un texto' })
  altura: string;

  @IsNotEmpty({ message: 'El ID de la referencia (ref) es requerido' })
  @IsString({ message: 'El ID de la referencia debe ser un texto' })
  ref: string;

  @IsNotEmpty({ message: 'Las tallas son requeridas' })
  @IsObject({
    message: 'Las tallas deben ser un objeto clave-valor (ej. {"38": 5})',
  })
  @Validate(TallasValidator)
  tallas: Record<string, number>;
}

import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsObject,
  Validate,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TallasValidator } from '../validators/tallas.validator';

export class CreateValeDto {
  @ApiProperty({
    description: 'Fecha de creación del vale',
    example: '2026-06-12',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'La fecha debe ser un texto con formato YYYY-MM-DD' })
  fecha?: string;

  @ApiProperty({
    description: 'Almacén/Destino del vale',
    example: 'Principal',
  })
  @IsNotEmpty({ message: 'El almacén es requerido' })
  @IsString({ message: 'El almacén debe ser un texto' })
  almacen: string;

  @ApiProperty({ description: 'Color del calzado', example: 'Negro' })
  @IsNotEmpty({ message: 'El color es requerido' })
  @IsString({ message: 'El color debe ser un texto' })
  color: string;

  @ApiProperty({ description: 'Altura del calzado', example: 'Media' })
  @IsNotEmpty({ message: 'La altura es requerida' })
  @IsString({ message: 'La altura debe ser un texto' })
  altura: string;

  @ApiProperty({
    description: 'ID de la referencia / modelo del calzado',
    example: 'REF-001',
  })
  @IsNotEmpty({ message: 'El ID de la referencia (ref) es requerido' })
  @IsString({ message: 'El ID de la referencia debe ser un texto' })
  ref: string;

  @ApiProperty({
    description: 'Objeto clave-valor con cantidad de calzado por talla',
    example: { '40': 4, '41': 10 },
  })
  @IsNotEmpty({ message: 'Las tallas son requeridas' })
  @IsObject({
    message: 'Las tallas deben ser un objeto clave-valor (ej. {"38": 5})',
  })
  @Validate(TallasValidator)
  tallas: Record<string, number>;
}

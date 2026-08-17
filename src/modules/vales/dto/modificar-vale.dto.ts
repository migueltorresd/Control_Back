import {
  IsOptional,
  IsString,
  IsNotEmpty,
  IsDateString,
  IsObject,
  Validate,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TallasValidator } from '../validators/tallas.validator';

/**
 * Modificación de un vale ya creado.
 *
 * `referenciaId` NO está y no es un olvido: la referencia define las tarifas de
 * cada oficio, y los registros de producción aprobados ya congelaron su monto
 * con esas tarifas. Cambiarla dejaría montos calculados contra un modelo que el
 * vale ya no tiene. Si hay que cambiar de referencia, se anula el vale y se
 * emite uno nuevo.
 */
export class ModificarValeDto {
  @ApiProperty({
    description: 'Fecha del vale',
    example: '2026-08-15',
    required: false,
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'La fecha debe tener un formato válido de fecha (YYYY-MM-DD)' },
  )
  fecha?: string;

  @ApiProperty({
    description: 'Almacén/Destino del vale',
    example: 'Principal',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'El almacén debe ser un texto' })
  almacen?: string;

  @ApiProperty({
    description: 'Color del calzado',
    example: 'Negro',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'El color debe ser un texto' })
  color?: string;

  @ApiProperty({
    description: 'Altura del calzado',
    example: 'Media',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'La altura debe ser un texto' })
  altura?: string;

  @ApiProperty({
    description: 'Administrativo que autoriza / dio de alta el vale',
    example: 'ADM-01',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'El ID del administrativo debe ser un texto' })
  creadoPorId?: string;

  @ApiProperty({
    description:
      'Tallas del vale. Reemplaza el cuadro completo, no lo mezcla: lo que no ' +
      'venga en el objeto deja de existir en el vale.',
    example: { '40': 4, '41': 10 },
    required: false,
  })
  @IsOptional()
  @IsObject({
    message: 'Las tallas deben ser un objeto clave-valor (ej. {"38": 5})',
  })
  @Validate(TallasValidator)
  tallas?: Record<string, number>;

  @ApiProperty({
    description:
      'Administrativo que realiza esta modificación. Obligatorio: el motivo ' +
      'entero de esta función es saber quién tocó el vale.',
    example: 'ADM-02',
  })
  @IsNotEmpty({ message: 'Indique qué administrativo realiza la modificación' })
  @IsString({ message: 'El ID del administrativo debe ser un texto' })
  modificadoPorId: string;
}

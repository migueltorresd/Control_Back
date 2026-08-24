import { IsString, IsNotEmpty, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Anulación de un documento de salida: venta o remisión.
 *
 * Mismas reglas que `AnularValeDto`, en un DTO compartido porque el dato es
 * idéntico y tener tres copias garantiza que un día se les cambie el mínimo a
 * dos de ellas y no a la tercera.
 *
 * No hay endpoint de borrado y no va a haberlo: lo anulado conserva su historia.
 */
export class AnularDto {
  @ApiProperty({
    description: 'Por qué se anula',
    example: 'El cliente devolvió la mercancía completa',
  })
  @IsNotEmpty({ message: 'El motivo de la anulación es requerido' })
  @IsString({ message: 'El motivo debe ser un texto' })
  @MinLength(5, {
    message: 'El motivo debe explicar algo: mínimo 5 caracteres',
  })
  @MaxLength(300, { message: 'El motivo no puede superar los 300 caracteres' })
  motivo: string;

  @ApiProperty({
    description: 'Administrativo que firma la anulación',
    example: 'ADM-02',
  })
  @IsNotEmpty({ message: 'Indique qué administrativo anula' })
  @IsString({ message: 'El ID del administrativo debe ser un texto' })
  anuladoPorId: string;
}

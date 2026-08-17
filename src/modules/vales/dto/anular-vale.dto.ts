import { IsString, IsNotEmpty, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Anulación de un vale. No hay endpoint de borrado y no va a haberlo: el vale
 * anulado conserva su producción, sus rechazos y su historia.
 */
export class AnularValeDto {
  @ApiProperty({
    description: 'Por qué se anula el vale',
    example: 'Se emitió con el color equivocado; se reemplaza por el V-0042',
  })
  @IsNotEmpty({ message: 'El motivo de la anulación es requerido' })
  @IsString({ message: 'El motivo debe ser un texto' })
  @MinLength(5, {
    message: 'El motivo debe explicar algo: mínimo 5 caracteres',
  })
  @MaxLength(300, { message: 'El motivo no puede superar los 300 caracteres' })
  motivo: string;

  @ApiProperty({
    description: 'Administrativo que anula el vale',
    example: 'ADM-02',
  })
  @IsNotEmpty({ message: 'Indique qué administrativo anula el vale' })
  @IsString({ message: 'El ID del administrativo debe ser un texto' })
  anuladoPorId: string;
}

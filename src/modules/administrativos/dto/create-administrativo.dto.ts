import {
  IsNotEmpty,
  IsString,
  IsEmail,
  IsInt,
  IsBoolean,
  Min,
  IsOptional,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAdministrativoDto {
  @ApiProperty({ description: 'ID del administrativo', required: false })
  @IsOptional()
  @IsString({ message: 'El ID debe ser un texto' })
  id?: string;

  @ApiProperty({ description: 'Nombre completo', example: 'Ana Gómez' })
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @IsString({ message: 'El nombre debe ser un texto' })
  nombre: string;

  @ApiProperty({
    description: 'Correo electrónico (único)',
    example: 'ana.gomez@taller.com',
  })
  @IsNotEmpty({ message: 'El correo es requerido' })
  @IsEmail({}, { message: 'El correo debe tener un formato válido' })
  correo: string;

  @ApiProperty({
    description: 'Cargo dentro del área administrativa',
    example: 'Jefe de planta',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'El cargo debe ser un texto' })
  cargo?: string;

  @ApiProperty({
    description: 'Antigüedad en años',
    example: 3,
    required: false,
  })
  @IsOptional()
  @IsInt({ message: 'La antigüedad debe ser un número entero' })
  @Min(0, { message: 'La antigüedad no puede ser negativa' })
  antiguedad?: number;

  @ApiProperty({
    description: 'Si está activo y puede seleccionarse en un vale',
    required: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'El estado activo debe ser verdadero o falso' })
  activo?: boolean;
}

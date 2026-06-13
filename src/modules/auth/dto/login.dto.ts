import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description: 'Nombre de usuario del empleado o administrador',
    example: 'admin-e2e',
  })
  @IsNotEmpty({ message: 'El usuario es requerido' })
  @IsString({ message: 'El usuario debe ser un texto' })
  username: string;

  @ApiProperty({
    description: 'Contraseña del usuario',
    example: 'ClaveDePruebas2026',
  })
  @IsNotEmpty({ message: 'La contraseña es requerida' })
  @IsString({ message: 'La contraseña debe ser un texto' })
  password: string;
}

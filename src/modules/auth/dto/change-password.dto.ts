import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsNotEmpty({ message: 'La contraseña actual es requerida' })
  @IsString({ message: 'La contraseña actual debe ser un texto' })
  passwordActual: string;

  @IsNotEmpty({ message: 'La contraseña nueva es requerida' })
  @IsString({ message: 'La contraseña nueva debe ser un texto' })
  @MinLength(10, {
    message: 'La contraseña nueva debe tener al menos 10 caracteres',
  })
  passwordNueva: string;
}

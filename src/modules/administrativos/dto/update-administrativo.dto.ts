import {
  IsOptional,
  IsString,
  IsEmail,
  IsInt,
  IsBoolean,
  Min,
} from 'class-validator';

export class UpdateAdministrativoDto {
  @IsOptional()
  @IsString({ message: 'El nombre debe ser un texto' })
  nombre?: string;

  @IsOptional()
  @IsEmail({}, { message: 'El correo debe tener un formato válido' })
  correo?: string;

  @IsOptional()
  @IsString({ message: 'El cargo debe ser un texto' })
  cargo?: string;

  @IsOptional()
  @IsInt({ message: 'La antigüedad debe ser un número entero' })
  @Min(0, { message: 'La antigüedad no puede ser negativa' })
  antiguedad?: number;

  @IsOptional()
  @IsBoolean({ message: 'El estado activo debe ser verdadero o falso' })
  activo?: boolean;
}

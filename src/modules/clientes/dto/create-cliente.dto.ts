import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEmail,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateClienteDto {
  @ApiProperty({ description: 'Nombre o razón social', example: 'Dotasif SAS' })
  @IsNotEmpty({ message: 'El nombre del cliente es requerido' })
  @IsString({ message: 'El nombre debe ser un texto' })
  @MaxLength(150, { message: 'El nombre no puede superar los 150 caracteres' })
  nombre: string;

  @ApiProperty({
    description: 'NIT o cédula. Si se carga, no puede repetirse.',
    required: false,
    example: '900123456-7',
  })
  @IsOptional()
  @IsString({ message: 'El documento debe ser un texto' })
  @MaxLength(40, { message: 'El documento no puede superar los 40 caracteres' })
  documento?: string;

  @ApiProperty({ required: false, example: 'Cra 45 # 12-30, Bucaramanga' })
  @IsOptional()
  @IsString({ message: 'La dirección debe ser un texto' })
  @MaxLength(200, {
    message: 'La dirección no puede superar los 200 caracteres',
  })
  direccion?: string;

  @ApiProperty({ required: false, example: '3105551234' })
  @IsOptional()
  @IsString({ message: 'El teléfono debe ser un texto' })
  @MaxLength(40, { message: 'El teléfono no puede superar los 40 caracteres' })
  telefono?: string;

  @ApiProperty({ required: false, example: 'compras@dotasif.com' })
  @IsOptional()
  @IsEmail({}, { message: 'El correo debe tener un formato válido' })
  @MaxLength(120, { message: 'El correo no puede superar los 120 caracteres' })
  correo?: string;
}

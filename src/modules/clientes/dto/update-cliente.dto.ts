import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CreateClienteDto } from './create-cliente.dto';

/**
 * Todos los campos son opcionales al editar, más `activo` para la baja lógica.
 *
 * Editar el nombre NO reescribe las remisiones ya emitidas: cada una conserva
 * el nombre con el que salió, que es lo que dice el papel firmado.
 */
export class UpdateClienteDto extends PartialType(CreateClienteDto) {
  @ApiProperty({
    description: 'Baja lógica. Un cliente con remisiones nunca se borra.',
    required: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'El estado activo debe ser verdadero o falso' })
  activo?: boolean;
}

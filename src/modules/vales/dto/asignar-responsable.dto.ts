import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AsignarResponsableDto {
  @ApiProperty({
    description: 'ID del administrativo que autoriza / dio de alta el vale',
    example: 'ADM-01',
  })
  @IsNotEmpty({ message: 'El administrativo es requerido' })
  @IsString({ message: 'El ID del administrativo debe ser un texto' })
  creadoPorId: string;
}

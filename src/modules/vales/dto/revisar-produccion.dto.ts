import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RevisarProduccionDto {
  @ApiProperty({
    description: 'Cantidad de pares aprobados durante el control de calidad',
    example: 7,
  })
  @IsInt()
  @Min(0)
  paresAprobados: number;

  @ApiProperty({
    description:
      'Motivo del rechazo si hay pares defectuosos (opcional a menos que haya defectuosos)',
    example: 'Costura defectuosa',
    required: false,
  })
  @IsString()
  @IsOptional()
  motivo?: string;
}

import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class RevisarProduccionDto {
  @IsInt()
  @Min(0)
  paresAprobados: number;

  @IsString()
  @IsOptional()
  motivo?: string;
}

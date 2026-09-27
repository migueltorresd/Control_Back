import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsPositive,
  IsOptional,
  IsDateString,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MetodoAbono } from '../../../common/enums/metodo-abono.enum';

export class CreateAbonoDto {
  @ApiProperty({ description: 'Cuánto abona el cliente', example: 500000 })
  @IsNotEmpty({ message: 'El monto del abono es requerido' })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El monto debe ser un número' })
  // Positive y no Min(0): un abono de cero no es un abono, es ruido en el
  // historial de cobranza.
  @IsPositive({ message: 'El monto del abono debe ser mayor a cero' })
  monto: number;

  @ApiProperty({ enum: MetodoAbono, example: MetodoAbono.TRANSFERENCIA })
  @IsNotEmpty({ message: 'Indique cómo se recibió el abono' })
  @IsEnum(MetodoAbono, {
    message: 'El método debe ser EFECTIVO o TRANSFERENCIA',
  })
  metodo: MetodoAbono;

  @ApiProperty({ required: false, example: '2026-09-26' })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'La fecha debe tener un formato válido (YYYY-MM-DD)' },
  )
  fecha?: string;

  @ApiProperty({ required: false, example: 'Consignación Bancolombia' })
  @IsOptional()
  @IsString({ message: 'Las observaciones deben ser un texto' })
  @MaxLength(300, {
    message: 'Las observaciones no pueden superar los 300 caracteres',
  })
  observaciones?: string;

  @ApiProperty({
    description: 'Administrativo que recibe el abono',
    example: 'ADM-01',
  })
  @IsNotEmpty({ message: 'Indique qué administrativo registra el abono' })
  @IsString({ message: 'El ID del administrativo debe ser un texto' })
  registradoPorId: string;
}

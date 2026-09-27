import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  IsInt,
  Min,
  IsNumber,
  IsOptional,
  IsDateString,
  IsEnum,
  IsArray,
  ArrayMinSize,
  ValidateNested,
  ValidateIf,
  MaxLength,
} from 'class-validator';
import { FormaPago } from '../../../common/enums/forma-pago.enum';

/**
 * Un renglón del talonario: qué vale sale, cuántos pares y a cómo.
 *
 * Es el mismo trío que ya guardaba una venta, porque al guardarse se convierte
 * exactamente en eso.
 */
export class RemisionItemDto {
  @IsNotEmpty({ message: 'El ID del vale es requerido' })
  @IsString({ message: 'El ID del vale debe ser un texto' })
  valeId: string;

  @IsNotEmpty({ message: 'La cantidad de pares es requerida' })
  @IsInt({ message: 'La cantidad de pares debe ser un número entero' })
  @Min(1, { message: 'La cantidad de pares debe ser mayor a 0' })
  pares: number;

  @IsNotEmpty({ message: 'El valor unitario es requerido' })
  @IsNumber({}, { message: 'El valor unitario debe ser un número' })
  @Min(0, { message: 'El valor unitario no puede ser negativo' })
  precioUnitario: number;
}

export class CreateRemisionDto {
  /**
   * Cliente del catálogo. Es la forma recomendada de emitir: los datos salen
   * de un registro único, así que la cartera lo agrupa sin adivinar por el
   * nombre.
   */
  @IsOptional()
  @IsString({ message: 'El id del cliente debe ser un texto' })
  clienteId?: string;

  /**
   * Solo obligatorio cuando NO se manda `clienteId`. Con cliente del catálogo
   * los datos se toman de allí, y lo que llegue aquí los sobrescribe (sirve
   * para una entrega puntual a otra dirección sin tocar el catálogo).
   */
  @ValidateIf((o: CreateRemisionDto) => !o.clienteId)
  @IsNotEmpty({ message: 'El nombre del cliente es requerido' })
  @IsString({ message: 'El nombre del cliente debe ser un texto' })
  @MaxLength(160, {
    message: 'El nombre del cliente no puede pasar de 160 caracteres',
  })
  clienteNombre: string;

  @IsOptional()
  @IsString({ message: 'El documento debe ser un texto' })
  @MaxLength(40, { message: 'El documento no puede pasar de 40 caracteres' })
  clienteDocumento?: string;

  @IsOptional()
  @IsString({ message: 'La dirección debe ser un texto' })
  @MaxLength(200, { message: 'La dirección no puede pasar de 200 caracteres' })
  clienteDireccion?: string;

  @IsNotEmpty({ message: 'La forma de pago es requerida' })
  @IsEnum(FormaPago, {
    message: 'La forma de pago debe ser EFECTIVO, TRANSFERENCIA o CREDITO',
  })
  formaPago: FormaPago;

  @IsOptional()
  @IsString({ message: 'Las observaciones deben ser un texto' })
  observaciones?: string;

  @IsOptional()
  @IsDateString(
    {},
    { message: 'La fecha debe tener un formato de fecha válido (YYYY-MM-DD)' },
  )
  fecha?: string;

  @IsArray({ message: 'Los renglones deben venir en una lista' })
  @ArrayMinSize(1, { message: 'La remisión debe tener al menos un renglón' })
  @ValidateNested({ each: true })
  @Type(() => RemisionItemDto)
  items: RemisionItemDto[];
}

import { IsNotEmpty, IsEnum } from 'class-validator';
import { EstadoProduccion } from '../../../common/enums/estado-produccion.enum';

export class UpdateProduccionEstadoDto {
  @IsNotEmpty({ message: 'El estado es requerido' })
  @IsEnum(EstadoProduccion, {
    message: 'El estado debe ser registrado, aprobado o pagado',
  })
  estado: EstadoProduccion;
}

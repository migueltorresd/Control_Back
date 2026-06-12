import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ProduccionService } from './produccion.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../auth/enums/rol.enum';

@ApiTags('Rechazos de Calidad')
@ApiBearerAuth()
@Controller('rechazos')
@Roles(Rol.ADMIN)
export class RechazosController {
  constructor(private readonly produccionService: ProduccionService) {}

  @Get()
  @ApiOperation({
    summary: 'Obtener historial de pares rechazados / defectuosos (ADMIN)',
  })
  async findAll(
    @Query('valeId') valeId?: string,
    @Query('operarioId') operarioId?: string,
  ) {
    return this.produccionService.findRechazos(valeId, operarioId);
  }
}

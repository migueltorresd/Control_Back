import { Controller, Get, Query } from '@nestjs/common';
import { ProduccionService } from './produccion.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../auth/enums/rol.enum';

@Controller('rechazos')
@Roles(Rol.ADMIN)
export class RechazosController {
  constructor(private readonly produccionService: ProduccionService) {}

  @Get()
  async findAll(
    @Query('valeId') valeId?: string,
    @Query('operarioId') operarioId?: string,
  ) {
    return this.produccionService.findRechazos(valeId, operarioId);
  }
}

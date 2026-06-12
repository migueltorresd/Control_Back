import { Controller, Get, Query } from '@nestjs/common';
import { AuditoriaService } from './auditoria.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../auth/enums/rol.enum';

@Controller('auditoria')
@Roles(Rol.ADMIN)
export class AuditoriaController {
  constructor(private readonly auditoriaService: AuditoriaService) {}

  @Get()
  async find(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('entidadId') entidadId?: string,
  ) {
    return this.auditoriaService.find({ page, limit, entidadId });
  }
}

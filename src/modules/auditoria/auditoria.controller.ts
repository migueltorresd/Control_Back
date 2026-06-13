import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuditoriaService } from './auditoria.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../auth/enums/rol.enum';

@ApiTags('Auditoría')
@ApiBearerAuth()
@Controller('auditoria')
@Roles(Rol.ADMIN)
export class AuditoriaController {
  constructor(private readonly auditoriaService: AuditoriaService) {}

  @Get()
  @ApiOperation({ summary: 'Listar registros de auditoría (ADMIN)' })
  async find(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('entidadId') entidadId?: string,
  ) {
    return this.auditoriaService.find({ page, limit, entidadId });
  }
}

import { Controller, Get, Post, Patch, Body, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ClientesService } from './clientes.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../auth/enums/rol.enum';

@ApiTags('Clientes')
@ApiBearerAuth()
@Controller('clientes')
@Roles(Rol.ADMIN)
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Get()
  @ApiOperation({
    summary:
      'Catálogo de clientes, activos e inactivos, en orden alfabético (ADMIN)',
  })
  findAll() {
    return this.clientesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Un cliente por su id (ADMIN)' })
  findOne(@Param('id') id: string) {
    return this.clientesService.findOne(id);
  }

  @Post()
  @ApiOperation({
    summary:
      'Crea un cliente (ADMIN). Rechaza nombres repetidos ignorando ' +
      'tildes, puntuación y mayúsculas, y documentos ya cargados.',
  })
  create(@Body() dto: CreateClienteDto) {
    return this.clientesService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary:
      'Edita un cliente o lo da de baja con `activo: false` (ADMIN). ' +
      'No reescribe las remisiones ya emitidas.',
  })
  update(@Param('id') id: string, @Body() dto: UpdateClienteDto) {
    return this.clientesService.update(id, dto);
  }
}

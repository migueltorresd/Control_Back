import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { AdministrativosService } from './administrativos.service';
import { CreateAdministrativoDto } from './dto/create-administrativo.dto';
import { UpdateAdministrativoDto } from './dto/update-administrativo.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../auth/enums/rol.enum';

@ApiTags('Administrativos')
@ApiBearerAuth()
@Controller('administrativos')
@Roles(Rol.ADMIN)
export class AdministrativosController {
  constructor(private readonly service: AdministrativosService) {}

  @Get()
  @ApiOperation({
    summary: 'Obtener el personal del área administrativa (ADMIN)',
  })
  @ApiQuery({
    name: 'activos',
    required: false,
    description: 'true para traer solo los seleccionables en un vale',
  })
  async findAll(@Query('activos') activos?: string) {
    return this.service.findAll(activos === 'true');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un administrativo por su ID (ADMIN)' })
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear o actualizar un administrativo (ADMIN)' })
  async save(@Body() dto: CreateAdministrativoDto) {
    if (dto.id) {
      const { id, ...resto } = dto;
      const updateDto: UpdateAdministrativoDto = resto;
      return this.service.update(id, updateDto);
    }
    return this.service.create(dto);
  }
}

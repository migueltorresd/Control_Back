import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { OperariosService } from './operarios.service';
import { CreateOperarioDto } from './dto/create-operario.dto';
import { UpdateOperarioDto } from './dto/update-operario.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../auth/enums/rol.enum';

@ApiTags('Operarios')
@ApiBearerAuth()
@Controller('operarios')
@Roles(Rol.ADMIN)
export class OperariosController {
  constructor(private readonly operariosService: OperariosService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener todos los operarios registrados (ADMIN)' })
  async findAll() {
    return this.operariosService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un operario por su ID (ADMIN)' })
  async findOne(@Param('id') id: string) {
    return this.operariosService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear o actualizar un operario (ADMIN)' })
  async save(@Body() dto: CreateOperarioDto & { id?: string }) {
    if (dto.id) {
      const { id, ...updateData } = dto;
      const updateDto: UpdateOperarioDto = updateData;
      return this.operariosService.update(id, updateDto);
    }
    return this.operariosService.create(dto);
  }
}

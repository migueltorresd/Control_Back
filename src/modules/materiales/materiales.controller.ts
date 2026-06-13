import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MaterialesService } from './materiales.service';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../auth/enums/rol.enum';

@ApiTags('Materiales')
@ApiBearerAuth()
@Controller('materiales')
@Roles(Rol.ADMIN)
export class MaterialesController {
  constructor(private readonly materialesService: MaterialesService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener todos los materiales registrados (ADMIN)' })
  async findAll() {
    return this.materialesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un material por su ID (ADMIN)' })
  async findOne(@Param('id') id: string) {
    return this.materialesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear o actualizar un material (ADMIN)' })
  async save(@Body() dto: CreateMaterialDto & { id?: string }) {
    if (dto.id) {
      const { id, ...updateData } = dto;
      // Mapeamos a UpdateMaterialDto
      const updateDto: UpdateMaterialDto = updateData;
      return this.materialesService.update(id, updateDto);
    }
    return this.materialesService.create(dto);
  }
}

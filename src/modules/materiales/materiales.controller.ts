import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MaterialesService } from './materiales.service';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { MaterialesQueryDto } from './dto/materiales-query.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../auth/enums/rol.enum';

@ApiTags('Materiales')
@ApiBearerAuth()
@Controller('materiales')
@Roles(Rol.ADMIN)
export class MaterialesController {
  constructor(private readonly materialesService: MaterialesService) {}

  @Get()
  @ApiOperation({
    summary:
      'Obtener materiales, con filtro por tipo y búsqueda. Paginación opt-in (ADMIN)',
  })
  async findAll(@Query() query: MaterialesQueryDto) {
    const filtros = { tipo: query.tipo, q: query.q };

    // Modo paginado opt-in: solo si llegan page/limit. Sin ellos devuelve el
    // array plano, que es lo que el frontend carga entero para calcular costos.
    if (query.esPaginado) {
      const page = query.page ?? 1;
      const limit = query.limit ?? 50;
      const { data, total } = await this.materialesService.findAllPaginated({
        ...filtros,
        page,
        limit,
      });
      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }

    return this.materialesService.findAll(filtros);
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

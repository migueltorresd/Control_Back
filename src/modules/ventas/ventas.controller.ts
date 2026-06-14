import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { VentasService } from './ventas.service';
import { CreateVentaDto } from './dto/create-venta.dto';
import { UpdateVentaDto } from './dto/update-venta.dto';
import { Venta } from './entities/venta.entity';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../auth/enums/rol.enum';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@ApiTags('Ventas y Despachos')
@ApiBearerAuth()
@Controller('ventas')
@Roles(Rol.ADMIN)
export class VentasController {
  constructor(private readonly ventasService: VentasService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener todas las ventas registradas (ADMIN)' })
  async findAll(@Query() query: PaginationQueryDto) {
    if (query.esPaginado) {
      const page = query.page ?? 1;
      const limit = query.limit ?? 50;
      const { data, total } = await this.ventasService.findAllPaginated({
        page,
        limit,
        desde: query.desde,
        hasta: query.hasta,
      });
      return {
        data: data.map((v) => this.mapToFrontend(v)),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }
    const ventas = await this.ventasService.findAll();
    return ventas.map((v) => this.mapToFrontend(v));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una venta específica por su ID (ADMIN)' })
  async findOne(@Param('id') id: string) {
    const venta = await this.ventasService.findOne(id);
    return this.mapToFrontend(venta);
  }

  @Post()
  @ApiOperation({ summary: 'Registrar una nueva venta/despacho (ADMIN)' })
  async create(@Body() dto: CreateVentaDto) {
    const created = await this.ventasService.create(dto);
    return this.mapToFrontend(created);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una venta/despacho existente (ADMIN)' })
  async update(@Param('id') id: string, @Body() dto: UpdateVentaDto) {
    const updated = await this.ventasService.update(id, dto);
    return this.mapToFrontend(updated);
  }

  @Delete(':id')
  @ApiOperation({
    summary:
      'Eliminar una venta y devolver los pares al stock del vale (ADMIN)',
  })
  async remove(@Param('id') id: string) {
    await this.ventasService.remove(id);
    return { success: true };
  }

  private mapToFrontend(v: Venta) {
    return {
      id: v.id,
      fecha: v.fecha,
      vale: v.valeId,
      pares: v.pares,
      precioUnitario: v.precioUnitario,
      total: parseFloat((v.pares * v.precioUnitario).toFixed(2)),
      ref: v.vale?.referenciaId || null,
      color: v.vale?.color || null,
    };
  }
}

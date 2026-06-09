import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { VentasService } from './ventas.service';
import { CreateVentaDto } from './dto/create-venta.dto';
import { UpdateVentaDto } from './dto/update-venta.dto';
import { Venta } from './entities/venta.entity';

@Controller('ventas')
export class VentasController {
  constructor(
    private readonly ventasService: VentasService,
  ) {}

  @Get()
  async findAll() {
    const ventas = await this.ventasService.findAll();
    return ventas.map(v => this.mapToFrontend(v));
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const venta = await this.ventasService.findOne(id);
    return this.mapToFrontend(venta);
  }

  @Post()
  async create(@Body() dto: CreateVentaDto) {
    const created = await this.ventasService.create(dto);
    return this.mapToFrontend(created);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateVentaDto) {
    const updated = await this.ventasService.update(id, dto);
    return this.mapToFrontend(updated);
  }

  @Delete(':id')
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

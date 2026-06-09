import { Controller, Get, Post, Delete, Param, Body } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Venta } from '../entities/venta.entity';
import { Vale } from '../entities/vale.entity';

@Controller('ventas')
export class VentasController {
  constructor(
    @InjectRepository(Venta)
    private readonly ventaRepo: Repository<Venta>,
    @InjectRepository(Vale)
    private readonly valeRepo: Repository<Vale>,
  ) {}

  @Get()
  async findAll() {
    const list = await this.ventaRepo.find({ order: { id: 'DESC' } });
    return list.map(v => ({
      id: v.id,
      fecha: v.fecha,
      vale: v.valeId,
      ref: v.refId,
      color: v.color,
      pares: v.pares,
      precio: v.precio,
      monto: v.monto,
    }));
  }

  @Post()
  async create(@Body() body: any) {
    const { valeId, pares, precio, fecha } = body;
    const vale = await this.valeRepo.findOneBy({ vale: valeId });
    if (!vale) {
      throw new Error('Vale no encontrado');
    }
    const monto = parseFloat(pares) * parseFloat(precio);
    const newVenta = this.ventaRepo.create({
      id: 'VT-' + Date.now(),
      fecha,
      valeId,
      refId: vale.refId,
      color: vale.color,
      pares: parseInt(pares),
      precio: parseFloat(precio),
      monto,
    });
    const saved = await this.ventaRepo.save(newVenta);
    return {
      id: saved.id,
      fecha: saved.fecha,
      vale: saved.valeId,
      ref: saved.refId,
      color: saved.color,
      pares: saved.pares,
      precio: saved.precio,
      monto: saved.monto,
    };
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.ventaRepo.delete(id);
    return { success: true };
  }
}

import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vale } from '../entities/vale.entity';
import { ProduccionReg } from '../entities/produccion-reg.entity';
import { Pago } from '../entities/pago.entity';
import { Referencia } from '../entities/referencia.entity';

@Controller('vales')
export class ValesController {
  constructor(
    @InjectRepository(Vale)
    private readonly valeRepo: Repository<Vale>,
    @InjectRepository(ProduccionReg)
    private readonly produccionRegRepo: Repository<ProduccionReg>,
    @InjectRepository(Pago)
    private readonly pagoRepo: Repository<Pago>,
    @InjectRepository(Referencia)
    private readonly referenciaRepo: Repository<Referencia>,
  ) {}

  @Get()
  async findAll() {
    const vales = await this.valeRepo.find({ order: { vale: 'ASC' } });
    const regs = await this.produccionRegRepo.find();

    return vales.map(v => {
      const produccion = {
        Cortador: [],
        Guarnecedor: [],
        Solador: [],
        Finizaje: [],
      };

      regs
        .filter(r => r.valeId === v.vale)
        .forEach(r => {
          if (produccion[r.etapa]) {
            produccion[r.etapa].push({
              id: r.id,
              operarioId: r.operarioId,
              pares: r.pares,
              estado: r.estado,
            });
          }
        });

      return {
        vale: v.vale,
        fecha: v.fecha,
        almacen: v.almacen,
        ref: v.refId,
        color: v.color,
        altura: v.altura,
        tallas: v.tallas,
        produccion,
      };
    });
  }

  @Post()
  async create(@Body() body: any) {
    const count = await this.valeRepo.count();
    const nextVale = 'V-' + String(count + 1).padStart(4, '0');
    const newVale = this.valeRepo.create({
      vale: nextVale,
      fecha: new Date().toISOString().split('T')[0],
      almacen: body.almacen,
      refId: body.ref,
      color: body.color,
      altura: body.altura,
      tallas: body.tallas,
    });
    const saved = await this.valeRepo.save(newVale);
    return {
      vale: saved.vale,
      fecha: saved.fecha,
      almacen: saved.almacen,
      ref: saved.refId,
      color: saved.color,
      altura: saved.altura,
      tallas: saved.tallas,
      produccion: { Cortador: [], Guarnecedor: [], Solador: [], Finizaje: [] },
    };
  }

  @Post(':id/registro')
  async addRegistro(@Param('id') valeId: string, @Body() body: any) {
    const { etapa, operarioId, pares } = body;
    const newReg = this.produccionRegRepo.create({
      valeId,
      etapa,
      operarioId,
      pares: parseInt(pares),
      estado: 'registrado',
    });
    const saved = await this.produccionRegRepo.save(newReg);
    return {
      id: saved.id,
      operarioId: saved.operarioId,
      pares: saved.pares,
      estado: saved.estado,
    };
  }

  @Patch(':id/registro/:regId')
  async updateRegistro(
    @Param('id') valeId: string,
    @Param('regId') regId: string,
    @Body() body: any,
  ) {
    const { estado } = body; // 'registrado' | 'aprobado' | 'pagado'
    const reg = await this.produccionRegRepo.findOneBy({ id: regId });
    if (!reg) return { success: false, message: 'Registro no encontrado' };

    const oldEstado = reg.estado;
    reg.estado = estado;
    await this.produccionRegRepo.save(reg);

    // Sync payments table in the backend
    const vale = await this.valeRepo.findOneBy({ vale: valeId });
    if (vale) {
      const ref = await this.referenciaRepo.findOneBy({ id: vale.refId });
      const tarifa = (ref?.tarifas || {})[reg.etapa] || 0;
      const monto = reg.pares * tarifa;
      const pagoId = `PG-${Date.now()}-${reg.id.slice(0, 8)}`;

      if (estado === 'pagado' && oldEstado !== 'pagado') {
        const newPago = this.pagoRepo.create({
          id: pagoId,
          fecha: new Date().toISOString().split('T')[0],
          operarioId: reg.operarioId,
          valeId: valeId,
          etapa: reg.etapa,
          pares: reg.pares,
          monto,
          refId: vale.refId,
        });
        await this.pagoRepo.save(newPago);
      } else if (oldEstado === 'pagado' && estado !== 'pagado') {
        // Find and delete the payment record matching this register
        // Since id has the regId suffix, we can find it
        const payments = await this.pagoRepo.find();
        const paymentToDelete = payments.find(p => p.valeId === valeId && p.etapa === reg.etapa && p.operarioId === reg.operarioId && p.pares === reg.pares);
        if (paymentToDelete) {
          await this.pagoRepo.remove(paymentToDelete);
        }
      }
    }

    return { success: true };
  }

  @Delete(':id/registro/:regId')
  async deleteRegistro(@Param('id') valeId: string, @Param('regId') regId: string) {
    await this.produccionRegRepo.delete(regId);
    return { success: true };
  }
}

import { Controller, Get, Post, Body } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pago } from '../entities/pago.entity';
import { ProduccionReg } from '../entities/produccion-reg.entity';
import { Vale } from '../entities/vale.entity';
import { Referencia } from '../entities/referencia.entity';

@Controller('pagos')
export class PagosController {
  constructor(
    @InjectRepository(Pago)
    private readonly pagoRepo: Repository<Pago>,
    @InjectRepository(ProduccionReg)
    private readonly produccionRegRepo: Repository<ProduccionReg>,
    @InjectRepository(Vale)
    private readonly valeRepo: Repository<Vale>,
    @InjectRepository(Referencia)
    private readonly referenciaRepo: Repository<Referencia>,
  ) {}

  @Get()
  async findAll() {
    const list = await this.pagoRepo.find({ order: { id: 'DESC' } });
    return list.map(p => ({
      id: p.id,
      fecha: p.fecha,
      operarioId: p.operarioId,
      vale: p.valeId,
      etapa: p.etapa,
      pares: p.pares,
      monto: p.monto,
      ref: p.refId,
    }));
  }

  @Post('lote')
  async pagarLote(@Body() body: { items: Array<{ vale: string; etapa: string; regId: string }> }) {
    const { items } = body;
    const fecha = new Date().toISOString().split('T')[0];

    for (const item of items) {
      const reg = await this.produccionRegRepo.findOneBy({ id: item.regId });
      if (reg && reg.estado === 'aprobado') {
        reg.estado = 'pagado';
        await this.produccionRegRepo.save(reg);

        const vale = await this.valeRepo.findOneBy({ vale: item.vale });
        if (vale) {
          const ref = await this.referenciaRepo.findOneBy({ id: vale.refId });
          const tarifa = (ref?.tarifas || {})[reg.etapa] || 0;
          const monto = reg.pares * tarifa;
          const pagoId = `PG-${Date.now()}-${reg.id.slice(0, 8)}`;

          const newPago = this.pagoRepo.create({
            id: pagoId,
            fecha,
            operarioId: reg.operarioId,
            valeId: item.vale,
            etapa: reg.etapa,
            pares: reg.pares,
            monto,
            refId: vale.refId,
          });
          await this.pagoRepo.save(newPago);
        }
      }
    }

    return { success: true };
  }
}

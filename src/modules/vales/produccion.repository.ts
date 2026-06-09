import { Injectable } from '@nestjs/common';
import { DataSource, Repository, EntityManager } from 'typeorm';
import { ProduccionReg } from './entities/produccion-reg.entity';
import { Oficio } from '../../common/enums/oficio.enum';

@Injectable()
export class ProduccionRepository extends Repository<ProduccionReg> {
  constructor(private dataSource: DataSource) {
    super(ProduccionReg, dataSource.createEntityManager());
  }

  async findById(id: string): Promise<ProduccionReg | null> {
    return this.findOne({
      where: { id },
      relations: { vale: { referencia: true }, operario: true },
    });
  }

  async findByValeAndEtapa(valeId: string, etapa: Oficio): Promise<ProduccionReg[]> {
    return this.find({
      where: { valeId, etapa },
    });
  }

  async sumParesByValeAndEtapa(valeId: string, etapa: Oficio): Promise<number> {
    const result = await this.createQueryBuilder('reg')
      .select('SUM(reg.pares)', 'sum')
      .where('reg.valeId = :valeId', { valeId })
      .andWhere('reg.etapa = :etapa', { etapa })
      .getRawOne();
    return parseInt(result.sum || '0', 10);
  }

  async createAndSave(regData: Partial<ProduccionReg>): Promise<ProduccionReg> {
    const newReg = this.create(regData);
    return this.save(newReg);
  }

  async updateEstadoAndMonto(id: string, estado: any, montoPagado: number, manager?: EntityManager): Promise<ProduccionReg | null> {
    const repo = manager ? manager.getRepository(ProduccionReg) : this;
    await repo.update(id, { estado, montoPagado });
    return this.findById(id);
  }

  async removeReg(reg: ProduccionReg, manager?: EntityManager): Promise<void> {
    const repo = manager ? manager.getRepository(ProduccionReg) : this;
    await repo.remove(reg);
  }
}

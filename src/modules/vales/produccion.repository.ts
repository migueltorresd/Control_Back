import { Injectable } from '@nestjs/common';
import { DataSource, Repository, EntityManager } from 'typeorm';
import { ProduccionReg } from './entities/produccion-reg.entity';
import { Vale } from './entities/vale.entity';
import { Oficio } from '../../common/enums/oficio.enum';
import { EstadoProduccion } from '../../common/enums/estado-produccion.enum';

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

  async findByValeAndEtapa(
    valeId: string,
    etapa: Oficio,
  ): Promise<ProduccionReg[]> {
    return this.find({
      where: { valeId, etapa },
    });
  }

  /**
   * Registra producción de forma completamente atómica:
   * 1. Bloquea la fila del vale (pessimistic_write) para serializar requests concurrentes.
   * 2. Suma los pares ya registrados para la etapa (dentro del mismo lock).
   * 3. Valida el cupo.
   * 4. Inserta el nuevo registro.
   * Retorna null si se supera el cupo (el service lanza la excepción adecuada).
   */
  async registrarProduccionAtomico(
    regData: {
      valeId: string;
      etapa: Oficio;
      operarioId: string;
      pares: number;
      totalParesVale: number;
    },
  ): Promise<{ reg: ProduccionReg | null; paresYaRegistrados: number }> {
    return this.dataSource.transaction(async (manager) => {
      // 1. Bloquear la fila del vale para serializar requests concurrentes
      await manager.findOne(Vale, {
        where: { id: regData.valeId },
        lock: { mode: 'pessimistic_write' },
      });

      // 2. Sumar pares ya registrados para esta etapa (dentro del lock)
      const result = await manager
        .createQueryBuilder(ProduccionReg, 'reg')
        .select('SUM(reg.pares)', 'sum')
        .where('reg.valeId = :valeId', { valeId: regData.valeId })
        .andWhere('reg.etapa = :etapa', { etapa: regData.etapa })
        .getRawOne();
      const paresYaRegistrados = parseInt(result.sum || '0', 10);

      // 3. Validar cupo — si supera, retornar sin insertar
      if (paresYaRegistrados + regData.pares > regData.totalParesVale) {
        return { reg: null, paresYaRegistrados };
      }

      // 4. Insertar el nuevo registro de producción
      const newReg = manager.create(ProduccionReg, {
        valeId: regData.valeId,
        etapa: regData.etapa,
        operarioId: regData.operarioId,
        pares: regData.pares,
        estado: EstadoProduccion.REGISTRADO,
        montoPagado: 0,
      });
      const saved = await manager.save(ProduccionReg, newReg);
      return { reg: saved, paresYaRegistrados };
    });
  }

  /**
   * Actualización atómica de estado y monto usando UPDATE ... WHERE estado = :estadoActual.
   * Retorna `true` si la fila fue actualizada, `false` si el estado ya cambió (conflicto).
   */
  async updateEstadoAtomico(
    id: string,
    estadoActual: EstadoProduccion,
    nuevoEstado: EstadoProduccion,
    nuevoMonto: number,
    manager?: EntityManager,
  ): Promise<boolean> {
    const repo = manager ? manager.getRepository(ProduccionReg) : this;
    const result = await repo.update(
      { id, estado: estadoActual },
      { estado: nuevoEstado, montoPagado: nuevoMonto },
    );
    return (result.affected ?? 0) === 1;
  }

  async removeReg(reg: ProduccionReg, manager?: EntityManager): Promise<void> {
    const repo = manager ? manager.getRepository(ProduccionReg) : this;
    await repo.remove(reg);
  }
}

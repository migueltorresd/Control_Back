import { Injectable } from '@nestjs/common';
import { DataSource, Repository, EntityManager } from 'typeorm';
import { ProduccionReg } from './entities/produccion-reg.entity';
import { Vale } from './entities/vale.entity';
import { Oficio } from '../../common/enums/oficio.enum';
import { EstadoProduccion } from '../../common/enums/estado-produccion.enum';

/** Resultado del cierre de una asignación (ver `cargarParesAtomico`). */
export type ResultadoCargaPares =
  | { ok: true; reg: ProduccionReg }
  | { ok: false; motivo: 'cupo'; paresYaRegistrados: number }
  | { ok: false; motivo: 'conflicto' };

@Injectable()
export class ProduccionRepository extends Repository<ProduccionReg> {
  constructor(public readonly dataSource: DataSource) {
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
  async registrarProduccionAtomico(regData: {
    valeId: string;
    etapa: Oficio;
    operarioId: string;
    pares: number;
    totalParesVale: number;
  }): Promise<{ reg: ProduccionReg | null; paresYaRegistrados: number }> {
    return this.dataSource.transaction(async (manager) => {
      // 1. Bloquear la fila del vale para serializar requests concurrentes
      await manager.findOne(Vale, {
        where: { id: regData.valeId },
        lock: { mode: 'pessimistic_write' },
      });

      // 2. Sumar pares ya registrados para esta etapa (dentro del lock)
      const result = (await manager
        .createQueryBuilder(ProduccionReg, 'reg')
        .select('SUM(reg.pares)', 'sum')
        .where('reg.valeId = :valeId', { valeId: regData.valeId })
        .andWhere('reg.etapa = :etapa', { etapa: regData.etapa })
        .getRawOne()) as { sum: string | null };
      const paresYaRegistrados = parseInt(result.sum ?? '0', 10);

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
   * Crea una asignación: se sabe quién hace la etapa, todavía no cuántos pares.
   * No valida cupo porque no reserva pares (`pares` queda en NULL y el SUM del
   * cupo ignora los nulos). Retorna null si ese operario ya estaba asignado a
   * la misma etapa del vale, para no duplicar por doble clic.
   */
  async crearAsignacionAtomica(data: {
    valeId: string;
    etapa: Oficio;
    operarioId: string;
  }): Promise<ProduccionReg | null> {
    return this.dataSource.transaction(async (manager) => {
      // Mismo lock que la registración normal: serializa contra requests concurrentes
      await manager.findOne(Vale, {
        where: { id: data.valeId },
        lock: { mode: 'pessimistic_write' },
      });

      const yaAsignado = await manager.findOne(ProduccionReg, {
        where: {
          valeId: data.valeId,
          etapa: data.etapa,
          operarioId: data.operarioId,
          estado: EstadoProduccion.ASIGNADO,
        },
      });
      if (yaAsignado) return null;

      const nueva = manager.create(ProduccionReg, {
        valeId: data.valeId,
        etapa: data.etapa,
        operarioId: data.operarioId,
        pares: null,
        estado: EstadoProduccion.ASIGNADO,
        montoPagado: 0,
      });
      return manager.save(ProduccionReg, nueva);
    });
  }

  /**
   * Cierra una asignación cargándole los pares. Valida el cupo dentro del mismo
   * lock del vale, igual que la registración directa, y pasa a REGISTRADO.
   */
  async cargarParesAtomico(
    data: {
      regId: string;
      valeId: string;
      etapa: Oficio;
      pares: number;
      totalParesVale: number;
    },
    manager?: EntityManager,
  ): Promise<ResultadoCargaPares> {
    const ejecutar = async (
      manager: EntityManager,
    ): Promise<ResultadoCargaPares> => {
      await manager.findOne(Vale, {
        where: { id: data.valeId },
        lock: { mode: 'pessimistic_write' },
      });

      const result = (await manager
        .createQueryBuilder(ProduccionReg, 'reg')
        .select('SUM(reg.pares)', 'sum')
        .where('reg.valeId = :valeId', { valeId: data.valeId })
        .andWhere('reg.etapa = :etapa', { etapa: data.etapa })
        .getRawOne()) as { sum: string | null };
      const paresYaRegistrados = parseInt(result.sum ?? '0', 10);

      if (paresYaRegistrados + data.pares > data.totalParesVale) {
        return { ok: false, motivo: 'cupo', paresYaRegistrados };
      }

      // UPDATE condicionado al estado: si otro request ya la cerró, no pisa nada
      const actualizado = await manager.update(
        ProduccionReg,
        { id: data.regId, estado: EstadoProduccion.ASIGNADO },
        { pares: data.pares, estado: EstadoProduccion.REGISTRADO },
      );
      if ((actualizado.affected ?? 0) !== 1) {
        return { ok: false, motivo: 'conflicto' };
      }

      const reg = (await manager.findOne(ProduccionReg, {
        where: { id: data.regId },
      })) as ProduccionReg;
      return { ok: true, reg };
    };

    return manager
      ? ejecutar(manager)
      : this.dataSource.transaction((mgr) => ejecutar(mgr));
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

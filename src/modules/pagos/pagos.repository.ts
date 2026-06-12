import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Pago } from './entities/pago.entity';

@Injectable()
export class PagosRepository extends Repository<Pago> {
  constructor(public readonly dataSource: DataSource) {
    super(Pago, dataSource.createEntityManager());
  }

  async findAllOrdered(): Promise<Pago[]> {
    return this.find({
      relations: { operario: true, vale: true, referencia: true },
      order: { id: 'DESC' },
    });
  }

  async findByOperario(operarioId: string): Promise<Pago[]> {
    return this.find({
      where: { operarioId },
      relations: { operario: true, vale: true, referencia: true },
      order: { id: 'DESC' },
    });
  }

  async findById(id: string): Promise<Pago | null> {
    return this.findOne({
      where: { id },
      relations: {
        operario: true,
        vale: true,
        referencia: true,
        produccionReg: true,
      },
    });
  }

  async findByProduccionReg(produccionRegId: string): Promise<Pago | null> {
    return this.findOne({
      where: { produccionRegId },
      relations: {
        operario: true,
        vale: true,
        referencia: true,
        produccionReg: true,
      },
    });
  }

  async nextId(manager: EntityManager): Promise<string> {
    const n = await queryScalar<string>(
      manager,
      `SELECT nextval('pagos_seq') AS n`,
      'n',
    );
    return 'PG-' + String(Number(n)).padStart(4, '0');
  }

  // Transacción para registrar un solo pago
  async registrarPagoTransaccional(
    pagoData: {
      fecha: string;
      operarioId: string;
      valeId: string;
      etapa: string;
      pares: number;
      monto: number;
      refId: string;
      produccionRegId: string;
    },
    updateProduccionFn: (manager: EntityManager) => Promise<void>,
  ): Promise<Pago> {
    return this.dataSource.transaction(async (manager) => {
      // 1. Ejecutar la callback que actualiza el estado de producción
      await updateProduccionFn(manager);

      // 2. Obtener el siguiente ID de la secuencia (dentro de la transacción)
      const id = await this.nextId(manager);

      // 3. Guardar el pago
      const newPago = manager.create(Pago, { ...pagoData, id });
      return manager.save(Pago, newPago);
    });
  }

  // Transacción para registrar pagos en lote
  async registrarPagosEnLoteTransaccional(
    pagosData: {
      fecha: string;
      operarioId: string;
      valeId: string;
      etapa: string;
      pares: number;
      monto: number;
      refId: string;
      produccionRegId: string;
    }[],
    updateProduccionFn: (manager: EntityManager) => Promise<void>,
  ): Promise<Pago[]> {
    return this.dataSource.transaction(async (manager) => {
      // 1. Ejecutar la callback que actualiza todos los registros de producción
      await updateProduccionFn(manager);

      // 2. Obtener IDs secuenciales para todos los pagos del lote (dentro de la transacción)
      const pagos: Pago[] = [];
      for (const pagoData of pagosData) {
        const id = await this.nextId(manager);
        const pago = manager.create(Pago, { ...pagoData, id });
        pagos.push(pago);
      }

      // 3. Guardar todos los pagos
      return manager.save(Pago, pagos);
    });
  }

  // Transacción para anular un pago
  async anularPagoTransaccional(
    pagoId: string,
    updateProduccionFn: (manager: EntityManager) => Promise<void>,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      // 1. Ejecutar la callback que revierte el estado de producción
      await updateProduccionFn(manager);

      // 2. Borrar el comprobante de pago
      await manager.delete(Pago, pagoId);
    });
  }
}

/** Helper tipado para queries escalares de TypeORM (manager.query devuelve any[]) */
async function queryScalar<T>(
  manager: EntityManager,
  sql: string,
  col: string,
): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const rows = await manager.query(sql);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  return rows[0][col] as T;
}

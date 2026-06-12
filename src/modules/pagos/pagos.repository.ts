import { Injectable } from '@nestjs/common';
import { DataSource, Repository, EntityManager } from 'typeorm';
import { Pago } from './entities/pago.entity';

@Injectable()
export class PagosRepository extends Repository<Pago> {
  constructor(private dataSource: DataSource) {
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

  // Transacción para registrar un solo pago
  async registrarPagoTransaccional(
    pagoData: {
      id: string;
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
      // 1. Ejecutar la callback que actualiza el estado de producción usando el manager
      await updateProduccionFn(manager);

      // 2. Guardar el pago
      const newPago = manager.create(Pago, pagoData);
      return manager.save(Pago, newPago);
    });
  }

  // Transacción para registrar pagos en lote
  async registrarPagosEnLoteTransaccional(
    pagosData: {
      id: string;
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
      // 1. Ejecutar la callback que actualiza todos los registros de producción en lote
      await updateProduccionFn(manager);

      // 2. Guardar los pagos
      const pagos = pagosData.map((p) => manager.create(Pago, p));
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

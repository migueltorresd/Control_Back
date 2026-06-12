import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Venta } from './entities/venta.entity';

@Injectable()
export class VentasRepository extends Repository<Venta> {
  constructor(private dataSource: DataSource) {
    super(Venta, dataSource.createEntityManager());
  }

  async findAllWithRelations(): Promise<Venta[]> {
    return this.find({
      relations: {
        vale: {
          referencia: true,
        },
      },
      order: { id: 'DESC' },
    });
  }

  async findByIdWithRelations(id: string): Promise<Venta | null> {
    return this.findOne({
      where: { id },
      relations: {
        vale: {
          referencia: true,
        },
      },
    });
  }

  async nextId(manager: EntityManager): Promise<string> {
    const result = await manager.query(`SELECT nextval('ventas_seq') AS n`);
    const n = Number(result[0].n);
    return 'VT-' + String(n).padStart(4, '0');
  }

  async createAndSave(ventaData: Omit<Partial<Venta>, 'id'>): Promise<Venta> {
    return this.dataSource.transaction(async (manager) => {
      const id = await this.nextId(manager);
      // insert, no save: ante colisión de ID debe fallar, nunca sobrescribir
      await manager.insert(Venta, { ...ventaData, id });
      return manager.findOneByOrFail(Venta, { id });
    });
  }
}

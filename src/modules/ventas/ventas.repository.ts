import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
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

  async findLast(): Promise<Venta | null> {
    return this.findOne({
      where: {},
      order: { id: 'DESC' },
    });
  }

  async createAndSave(ventaData: Partial<Venta>): Promise<Venta> {
    const newVenta = this.create(ventaData);
    return this.save(newVenta);
  }
}

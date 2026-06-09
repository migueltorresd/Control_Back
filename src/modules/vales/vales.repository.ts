import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Vale } from './entities/vale.entity';
import { ValeTalla } from './entities/vale-talla.entity';

@Injectable()
export class ValesRepository extends Repository<Vale> {
  constructor(private dataSource: DataSource) {
    super(Vale, dataSource.createEntityManager());
  }

  async findAllWithRelations(): Promise<Vale[]> {
    return this.find({
      relations: { referencia: true, tallas: true, produccion: { operario: true } },
      order: { id: 'ASC' },
    });
  }

  async findByIdWithRelations(id: string): Promise<Vale | null> {
    return this.findOne({
      where: { id },
      relations: { referencia: true, tallas: true, produccion: { operario: true } },
    });
  }

  async findLast(): Promise<Vale | null> {
    return this.findOne({ where: {}, order: { id: 'DESC' } });
  }

  async crearConRelaciones(
    valeData: { id: string; fecha: string; almacen: string; color: string; altura: string; referenciaId: string },
    tallasData: { talla: number; cantidad: number }[]
  ): Promise<Vale> {
    return this.dataSource.transaction(async (manager) => {
      // 1. Guardar el Vale
      const newVale = manager.create(Vale, valeData);
      const savedVale = await manager.save(Vale, newVale);

      // 2. Guardar las Tallas del vale
      if (tallasData && tallasData.length > 0) {
        const tallas = tallasData.map(t => manager.create(ValeTalla, {
          ...t,
          vale: savedVale,
        }));
        await manager.save(ValeTalla, tallas);
      }

      // Retornar el vale creado con sus relaciones completas
      const result = await manager.findOne(Vale, {
        where: { id: savedVale.id },
        relations: { referencia: true, tallas: true, produccion: { operario: true } },
      });
      return result!;
    });
  }
}

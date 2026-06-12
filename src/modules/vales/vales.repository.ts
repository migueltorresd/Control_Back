import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Vale } from './entities/vale.entity';
import { ValeTalla } from './entities/vale-talla.entity';

@Injectable()
export class ValesRepository extends Repository<Vale> {
  constructor(private dataSource: DataSource) {
    super(Vale, dataSource.createEntityManager());
  }

  async findAllWithRelations(): Promise<Vale[]> {
    return this.find({
      relations: {
        referencia: true,
        tallas: true,
        produccion: { operario: true },
        rechazos: true,
      },
      order: { id: 'ASC' },
    });
  }

  async findByIdWithRelations(id: string): Promise<Vale | null> {
    return this.findOne({
      where: { id },
      relations: {
        referencia: true,
        tallas: true,
        produccion: { operario: true },
        rechazos: true,
      },
    });
  }

  async nextId(manager: EntityManager): Promise<string> {
    const result = await manager.query(`SELECT nextval('vales_seq') AS n`);
    const n = Number(result[0].n);
    return 'V-' + String(n).padStart(4, '0');
  }

  async crearConRelaciones(
    valeData: {
      fecha: string;
      almacen: string;
      color: string;
      altura: string;
      referenciaId: string;
    },
    tallasData: { talla: number; cantidad: number }[],
  ): Promise<Vale> {
    return this.dataSource.transaction(async (manager) => {
      // 1. Obtener el siguiente ID de la secuencia (dentro de la transacción)
      const id = await this.nextId(manager);

      // 2. Insertar el Vale (insert, no save: ante una colisión de ID debe
      // fallar ruidosamente, nunca sobrescribir un vale existente)
      await manager.insert(Vale, { ...valeData, id });

      // 3. Insertar las Tallas del vale
      if (tallasData && tallasData.length > 0) {
        const tallas = tallasData.map((t) =>
          manager.create(ValeTalla, {
            ...t,
            vale: { id } as Vale,
          }),
        );
        await manager.save(ValeTalla, tallas);
      }

      // Retornar el vale creado con sus relaciones completas
      const result = await manager.findOne(Vale, {
        where: { id },
        relations: {
          referencia: true,
          tallas: true,
          produccion: { operario: true },
          rechazos: true,
        },
      });
      return result!;
    });
  }
}

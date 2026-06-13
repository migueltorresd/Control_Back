import { Injectable } from '@nestjs/common';
import {
  Between,
  DataSource,
  EntityManager,
  FindOptionsWhere,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
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

  async findPaginated(opts: {
    skip: number;
    take: number;
    desde?: string;
    hasta?: string;
  }): Promise<[Vale[], number]> {
    const where: FindOptionsWhere<Vale> = {};
    if (opts.desde && opts.hasta) where.fecha = Between(opts.desde, opts.hasta);
    else if (opts.desde) where.fecha = MoreThanOrEqual(opts.desde);
    else if (opts.hasta) where.fecha = LessThanOrEqual(opts.hasta);

    return this.findAndCount({
      where,
      relations: {
        referencia: true,
        tallas: true,
        produccion: { operario: true },
        rechazos: true,
      },
      order: { id: 'ASC' },
      skip: opts.skip,
      take: opts.take,
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
    const n = await queryScalar<string>(
      manager,
      `SELECT nextval('vales_seq') AS n`,
      'n',
    );
    return 'V-' + String(Number(n)).padStart(4, '0');
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

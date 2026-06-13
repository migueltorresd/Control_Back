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

  async findPaginated(opts: {
    skip: number;
    take: number;
    desde?: string;
    hasta?: string;
  }): Promise<[Venta[], number]> {
    const where: FindOptionsWhere<Venta> = {};
    if (opts.desde && opts.hasta) where.fecha = Between(opts.desde, opts.hasta);
    else if (opts.desde) where.fecha = MoreThanOrEqual(opts.desde);
    else if (opts.hasta) where.fecha = LessThanOrEqual(opts.hasta);

    return this.findAndCount({
      where,
      relations: {
        vale: {
          referencia: true,
        },
      },
      order: { id: 'DESC' },
      skip: opts.skip,
      take: opts.take,
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
    const n = await queryScalar<string>(
      manager,
      `SELECT nextval('ventas_seq') AS n`,
      'n',
    );
    return 'VT-' + String(Number(n)).padStart(4, '0');
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

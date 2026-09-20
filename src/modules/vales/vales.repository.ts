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
import { ULTIMA_ETAPA } from '../../common/enums/oficio.enum';
import { EstadoDocumento } from '../../common/enums/estado-documento.enum';

@Injectable()
export class ValesRepository extends Repository<Vale> {
  // Público como en PagosRepository y ProduccionRepository: el servicio necesita
  // abrir la transacción que envuelve el cambio del vale y su auditoría juntos.
  constructor(public readonly dataSource: DataSource) {
    super(Vale, dataSource.createEntityManager());
  }

  async findAllWithRelations(): Promise<Vale[]> {
    return this.find({
      relations: {
        referencia: true,
        creadoPor: true,
        modificadoPor: true,
        anuladoPor: true,
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
        creadoPor: true,
        modificadoPor: true,
        anuladoPor: true,
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
        creadoPor: true,
        modificadoPor: true,
        anuladoPor: true,
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
      altura?: string | null;
      referenciaId: string;
      creadoPorId?: string | null;
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
          creadoPor: true,
          tallas: true,
          produccion: { operario: true },
          rechazos: true,
        },
      });
      return result!;
    });
  }

  /**
   * Aplica los cambios de una modificación dentro de la transacción que le pasen
   * (la abre el servicio, para que el UPDATE y su registro en `auditorias` vivan
   * o mueran juntos).
   *
   * Si vienen tallas, el cuadro se REEMPLAZA entero: se borran las filas
   * anteriores y se insertan las nuevas. Actualizar fila por fila obligaría a
   * resolver altas, bajas y cambios a mano, y una talla que el usuario quitó
   * quedaría viva por omisión.
   */
  async aplicarModificacion(
    id: string,
    cambios: Partial<Vale>,
    tallasData: { talla: number; cantidad: number }[] | undefined,
    manager: EntityManager,
  ): Promise<void> {
    if (Object.keys(cambios).length > 0) {
      await manager.update(Vale, { id }, cambios);
    }

    if (tallasData) {
      // Query builder y no `manager.delete(ValeTalla, { vale: { id } })`: en un
      // DELETE, TypeORM no resuelve criterios anidados por relación. Se apunta
      // directo a la FK, que se llama `valeId` (ver InitialSchema).
      await manager
        .createQueryBuilder()
        .delete()
        .from(ValeTalla)
        .where('"valeId" = :id', { id })
        .execute();
      const tallas = tallasData.map((t) =>
        manager.create(ValeTalla, { ...t, vale: { id } as Vale }),
      );
      await manager.save(ValeTalla, tallas);
    }
  }

  /** Recarga con todas las relaciones, usando el manager de la transacción en curso. */
  async findByIdWithRelationsEn(
    id: string,
    manager: EntityManager,
  ): Promise<Vale | null> {
    return manager.findOne(Vale, {
      where: { id },
      relations: {
        referencia: true,
        creadoPor: true,
        modificadoPor: true,
        anuladoPor: true,
        tallas: true,
        produccion: { operario: true },
        rechazos: true,
      },
    });
  }

  /**
   * Pares de un vale que están fabricados y todavía no salieron.
   *
   * `fabricados - vendidos`, con el MISMO criterio que usa el frontend, porque
   * un segundo criterio acá sería una segunda verdad: los dos números se
   * mostrarían juntos en pantalla y un día dirían cosas distintas.
   *
   * - Fabricado = salió de la última etapa de la línea. Cuenta el registro de
   *   producción aunque todavía no esté revisado ni pagado: el par existe
   *   físicamente, y eso es lo que se puede despachar.
   * - `pares` es nullable (una asignación sin cargar vale 0), de ahí el COALESCE
   *   sobre la suma.
   * - Las ventas anuladas NO descuentan: al anular, la mercancía volvió.
   *
   * El GREATEST a 0 espeja el `Math.max(0, ...)` del front: un stock negativo
   * es un dato corrupto, y mostrarlo en negativo no ayuda a nadie.
   *
   * Recibe el manager de la transacción en curso para poder validar y escribir
   * sin que otra request se cuele en el medio.
   */
  async stockDisponible(
    valeId: string,
    manager: EntityManager = this.manager,
  ): Promise<number> {
    const n = await queryScalarParams<string>(
      manager,
      `SELECT GREATEST(
         COALESCE((
           SELECT SUM(pr.pares) FROM produccion_registros pr
           WHERE pr."valeId" = $1 AND pr.etapa = $2
         ), 0)
         -
         COALESCE((
           SELECT SUM(v.pares) FROM ventas v
           WHERE v."valeId" = $1 AND v.estado = $3
         ), 0)
       , 0) AS n`,
      [valeId, ULTIMA_ETAPA, EstadoDocumento.ACTIVO],
      'n',
    );
    return Number(n);
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

/** Igual que `queryScalar`, pero con parámetros ligados — nunca interpolados. */
async function queryScalarParams<T>(
  manager: EntityManager,
  sql: string,
  params: unknown[],
  col: string,
): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const rows = await manager.query(sql, params);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  return rows[0][col] as T;
}

import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { Abono } from './entities/abono.entity';
import { EstadoDocumento } from '../../common/enums/estado-documento.enum';

@Injectable()
export class AbonosRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  findByRemision(remisionId: string): Promise<Abono[]> {
    return this.dataSource.getRepository(Abono).find({
      where: { remisionId },
      relations: { registradoPor: true, anuladoPor: true },
      // Del más reciente al más viejo: es el orden en que se revisa una cuenta.
      order: { fecha: 'DESC', id: 'DESC' },
    });
  }

  findOne(id: string): Promise<Abono | null> {
    return this.dataSource.getRepository(Abono).findOne({
      where: { id },
      relations: { registradoPor: true, anuladoPor: true, remision: true },
    });
  }

  save(abono: Abono): Promise<Abono> {
    return this.dataSource.getRepository(Abono).save(abono);
  }

  /**
   * Suma de los abonos VIGENTES de una remisión.
   *
   * Los anulados no cuentan: al anular uno, la deuda del cliente vuelve a subir.
   *
   * Acepta el manager de la transacción en curso para poder leer el saldo y
   * escribir el abono sin que otro cobro se cuele en el medio.
   */
  async totalAbonado(
    remisionId: string,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<number> {
    const filas = await manager.query<{ total: string | null }[]>(
      `SELECT SUM(monto) AS total FROM abonos
       WHERE "remisionId" = $1 AND estado = $2`,
      [remisionId, EstadoDocumento.ACTIVO],
    );
    return Number(filas[0]?.total ?? 0);
  }

  /** Total abonado de VARIAS remisiones de una sola consulta. */
  async totalesAbonados(remisionIds: string[]): Promise<Map<string, number>> {
    const mapa = new Map<string, number>();
    if (remisionIds.length === 0) return mapa;

    const filas = await this.dataSource.manager.query<
      { remisionId: string; total: string }[]
    >(
      `SELECT "remisionId", SUM(monto) AS total FROM abonos
       WHERE estado = $1 AND "remisionId" = ANY($2)
       GROUP BY "remisionId"`,
      [EstadoDocumento.ACTIVO, remisionIds],
    );
    filas.forEach((f) => mapa.set(f.remisionId, Number(f.total)));
    return mapa;
  }

  async nextId(manager: EntityManager): Promise<string> {
    const filas = await manager.query<{ n: string }[]>(
      `SELECT nextval('abonos_seq') AS n`,
    );
    return 'AB-' + String(Number(filas[0].n)).padStart(4, '0');
  }

  get dataSourceRef(): DataSource {
    return this.dataSource;
  }
}

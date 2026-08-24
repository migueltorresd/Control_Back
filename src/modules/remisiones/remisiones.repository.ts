import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { Remision } from './entities/remision.entity';

/** Relaciones que necesita la ficha de una remisión para armar sus renglones. */
const RELACIONES = {
  items: { vale: { referencia: true } },
} as const;

@Injectable()
export class RemisionesRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  findAll(): Promise<Remision[]> {
    return this.dataSource.getRepository(Remision).find({
      relations: RELACIONES,
      order: { numero: 'DESC' },
    });
  }

  findOne(numero: string): Promise<Remision | null> {
    return this.dataSource.getRepository(Remision).findOne({
      where: { numero },
      relations: RELACIONES,
    });
  }

  /**
   * Siguiente número del talonario.
   *
   * Lo da Postgres y no la aplicación: con dos vendedores emitiendo al mismo
   * tiempo, calcularlo con un `MAX(numero) + 1` les entregaría el mismo papel.
   * La secuencia arranca en 151 porque ahí iba el talonario físico.
   */
  async nextNumero(manager: EntityManager): Promise<string> {
    const filas = await manager.query<{ n: string }[]>(
      `SELECT nextval('remisiones_seq') AS n`,
    );
    return 'REM-' + String(Number(filas[0].n)).padStart(4, '0');
  }
}

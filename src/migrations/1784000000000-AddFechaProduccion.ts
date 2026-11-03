import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cuándo se registró cada producción.
 *
 * Hasta ahora `produccion_registros` guardaba quién, qué etapa y cuántos
 * pares, pero no el día. Por eso el sistema no podía responder cuánto se
 * produjo esta semana, ni comparar un mes contra otro, ni medir el ritmo de
 * un operario a lo largo del tiempo: sabía qué se hizo, nunca cuándo.
 *
 * Los registros que ya existen no tienen esa fecha y no hay forma de
 * recuperarla con exactitud. Se rellena con la mejor pista disponible, en
 * este orden:
 *
 *   1. `revisadoEn` — el visto bueno de calidad se da poco después de que el
 *      trabajo se entrega, así que es lo más cercano al momento real.
 *   2. La fecha del pago de esa misma etapa, vale y operario — más lejana,
 *      pero sigue acotando la semana.
 *
 * Lo que no tenga ninguna de las dos queda en NULL a propósito: es preferible
 * un hueco honesto a inventar una fecha. Poner `now()` en los 519 registros
 * viejos haría que los informes mostraran la producción de meses amontonada
 * en el día del despliegue.
 *
 * El DEFAULT se agrega DESPUÉS del relleno, para que no alcance a pisar las
 * filas existentes.
 */
export class AddFechaProduccion1784000000000 implements MigrationInterface {
  name = 'AddFechaProduccion1784000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "produccion_registros" ADD COLUMN "creadoEn" TIMESTAMP WITH TIME ZONE`,
    );

    // 1. Los revisados: la fecha de revisión es la mejor aproximación.
    await queryRunner.query(`
      UPDATE "produccion_registros"
      SET "creadoEn" = "revisadoEn"
      WHERE "revisadoEn" IS NOT NULL
    `);

    // 2. Los pagados sin revisión: la fecha del pago de esa misma etapa,
    //    vale y operario. Se toma el pago MÁS ANTIGUO porque un registro
    //    puede haberse pagado en varias partes y la primera es la más
    //    cercana al trabajo.
    await queryRunner.query(`
      UPDATE "produccion_registros" pr
      SET "creadoEn" = p.fecha::timestamptz
      FROM (
        SELECT "operarioId", "valeId", etapa, MIN(fecha) AS fecha
        FROM pagos
        GROUP BY "operarioId", "valeId", etapa
      ) p
      WHERE pr."creadoEn" IS NULL
        AND pr."operarioId" = p."operarioId"
        AND pr."valeId" = p."valeId"
        -- Cast a texto: la etapa es varchar en produccion_registros y un enum
        -- en pagos, y Postgres no compara los dos tipos directamente.
        AND pr.etapa = p.etapa::text
    `);

    // Recién ahora el default, para que solo lo tomen los registros nuevos.
    await queryRunner.query(
      `ALTER TABLE "produccion_registros" ALTER COLUMN "creadoEn" SET DEFAULT now()`,
    );

    // Los informes filtran por rango de fechas sobre esta columna.
    await queryRunner.query(
      `CREATE INDEX "IDX_produccion_creado_en" ON "produccion_registros" ("creadoEn")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_produccion_creado_en"`);
    await queryRunner.query(
      `ALTER TABLE "produccion_registros" DROP COLUMN IF EXISTS "creadoEn"`,
    );
  }
}

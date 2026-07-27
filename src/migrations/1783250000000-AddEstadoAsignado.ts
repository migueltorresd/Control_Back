import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Permite asignar un operario a una etapa sin saber todavía cuántos pares hizo
 * (la cantidad se cierra al final de la semana):
 *  - nuevo estado `asignado` en el enum de producción
 *  - `pares` pasa a admitir NULL mientras el registro sea solo una asignación
 *
 * El enum se recrea en vez de usar `ALTER TYPE ... ADD VALUE` porque ese comando
 * no permite usar el valor nuevo dentro de la misma transacción, y TypeORM corre
 * las migraciones en una.
 */
export class AddEstadoAsignado1783250000000 implements MigrationInterface {
  name = 'AddEstadoAsignado1783250000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "produccion_registros_estado_enum" RENAME TO "produccion_registros_estado_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "produccion_registros_estado_enum" AS ENUM('asignado', 'registrado', 'aprobado', 'pagado')`,
    );
    await queryRunner.query(
      `ALTER TABLE "produccion_registros" ALTER COLUMN "estado" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "produccion_registros" ALTER COLUMN "estado" TYPE "produccion_registros_estado_enum" USING "estado"::text::"produccion_registros_estado_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "produccion_registros" ALTER COLUMN "estado" SET DEFAULT 'registrado'`,
    );
    await queryRunner.query(`DROP TYPE "produccion_registros_estado_enum_old"`);

    await queryRunner.query(
      `ALTER TABLE "produccion_registros" ALTER COLUMN "pares" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Las asignaciones no tienen cantidad ni monto: se descartan al revertir.
    // Nunca hay plata involucrada porque no pueden aprobarse ni pagarse.
    await queryRunner.query(
      `DELETE FROM "produccion_registros" WHERE "estado" = 'asignado' OR "pares" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "produccion_registros" ALTER COLUMN "pares" SET NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TYPE "produccion_registros_estado_enum" RENAME TO "produccion_registros_estado_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "produccion_registros_estado_enum" AS ENUM('registrado', 'aprobado', 'pagado')`,
    );
    await queryRunner.query(
      `ALTER TABLE "produccion_registros" ALTER COLUMN "estado" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "produccion_registros" ALTER COLUMN "estado" TYPE "produccion_registros_estado_enum" USING "estado"::text::"produccion_registros_estado_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "produccion_registros" ALTER COLUMN "estado" SET DEFAULT 'registrado'`,
    );
    await queryRunner.query(`DROP TYPE "produccion_registros_estado_enum_old"`);
  }
}

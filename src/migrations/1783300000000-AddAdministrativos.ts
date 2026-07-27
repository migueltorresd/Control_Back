import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Personal del área administrativa y su vínculo con el vale.
 *
 * `vales.creadoPorId` es NULLABLE a propósito: los vales que ya existen se
 * crearon antes de que hubiera a quién atribuírselos. Inventar un responsable
 * para rellenar la columna sería falsificar trazabilidad — mejor un NULL honesto
 * que dice «no se sabe».
 *
 * ON DELETE RESTRICT: no se puede borrar un administrativo que tenga vales a su
 * nombre. Para sacarlo de circulación existe `activo = false`.
 */
export class AddAdministrativos1783300000000 implements MigrationInterface {
  name = 'AddAdministrativos1783300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "administrativos" (
        "id" character varying NOT NULL,
        "nombre" character varying NOT NULL,
        "correo" character varying NOT NULL,
        "cargo" character varying,
        "antiguedad" integer,
        "activo" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_administrativos" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_administrativos_correo" UNIQUE ("correo")
      )
    `);

    await queryRunner.query(
      `ALTER TABLE "vales" ADD "creadoPorId" character varying`,
    );
    await queryRunner.query(`
      ALTER TABLE "vales"
      ADD CONSTRAINT "FK_vales_creadoPor"
      FOREIGN KEY ("creadoPorId") REFERENCES "administrativos"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_vales_creadoPorId" ON "vales" ("creadoPorId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_vales_creadoPorId"`);
    await queryRunner.query(
      `ALTER TABLE "vales" DROP CONSTRAINT "FK_vales_creadoPor"`,
    );
    await queryRunner.query(`ALTER TABLE "vales" DROP COLUMN "creadoPorId"`);
    await queryRunner.query(`DROP TABLE "administrativos"`);
  }
}

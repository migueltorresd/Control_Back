import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Modificación y anulación de vales, con rastro de quién y cuándo.
 *
 * `estado` entra con DEFAULT 'activo' y NOT NULL: acá el default SÍ afirma algo
 * verdadero, porque todo vale que existe hoy está vigente — ninguno fue anulado
 * antes de que la anulación existiera. Es el caso opuesto al de `materiales.tipo`,
 * donde el NULL distinguía "sin clasificar" de un valor real.
 *
 * El resto de las columnas queda nullable y sin backfill: un vale que nunca se
 * tocó no tiene fecha de modificación, y ponerle la de la migración sería
 * inventar una edición que nadie hizo.
 *
 * Estas columnas son una CACHÉ para pintar la ficha del vale sin joins contra
 * `auditorias`. La verdad completa —el antes y el después de cada campo, y el
 * usuario autenticado que lo hizo— vive en `auditorias`, que ya existe.
 */
export class AddValeEstadoAnulacion1783550000000 implements MigrationInterface {
  name = 'AddValeEstadoAnulacion1783550000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "vales" ADD "estado" character varying(20) NOT NULL DEFAULT 'activo'`,
    );

    // Última modificación: cuándo, y qué administrativo la firmó.
    await queryRunner.query(
      `ALTER TABLE "vales" ADD "modificadoEn" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "vales" ADD "modificadoPorId" character varying`,
    );

    // Anulación: cuándo, quién y por qué. El motivo es obligatorio a nivel de
    // API, no de esquema: en la tabla es NULL para todos los vales vigentes.
    await queryRunner.query(
      `ALTER TABLE "vales" ADD "anuladoEn" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "vales" ADD "anuladoPorId" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "vales" ADD "motivoAnulacion" character varying(300)`,
    );

    // RESTRICT, igual que `creadoPorId`: un administrativo que anuló un vale no
    // se borra nunca, se desactiva. Ver el comentario en administrativo.entity.ts.
    await queryRunner.query(
      `ALTER TABLE "vales" ADD CONSTRAINT "FK_vales_modificadoPorId" ` +
        `FOREIGN KEY ("modificadoPorId") REFERENCES "administrativos"("id") ` +
        `ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "vales" ADD CONSTRAINT "FK_vales_anuladoPorId" ` +
        `FOREIGN KEY ("anuladoPorId") REFERENCES "administrativos"("id") ` +
        `ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    // El listado de vales filtra por estado en cada carga de la pantalla.
    await queryRunner.query(
      `CREATE INDEX "IDX_vales_estado" ON "vales" ("estado")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_vales_estado"`);
    await queryRunner.query(
      `ALTER TABLE "vales" DROP CONSTRAINT "FK_vales_anuladoPorId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "vales" DROP CONSTRAINT "FK_vales_modificadoPorId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "vales" DROP COLUMN "motivoAnulacion"`,
    );
    await queryRunner.query(`ALTER TABLE "vales" DROP COLUMN "anuladoPorId"`);
    await queryRunner.query(`ALTER TABLE "vales" DROP COLUMN "anuladoEn"`);
    await queryRunner.query(
      `ALTER TABLE "vales" DROP COLUMN "modificadoPorId"`,
    );
    await queryRunner.query(`ALTER TABLE "vales" DROP COLUMN "modificadoEn"`);
    await queryRunner.query(`ALTER TABLE "vales" DROP COLUMN "estado"`);
  }
}

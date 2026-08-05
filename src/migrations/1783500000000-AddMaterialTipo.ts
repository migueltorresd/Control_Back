import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Clasificación del material por la etapa del taller que lo consume.
 *
 * Nullable a propósito, y sin backfill. Los materiales que el cliente ya cargó
 * no tienen tipo, y ponerles `DEFAULT 'OTROS'` sería afirmar algo falso: no son
 * "otros", es que todavía nadie los clasificó. NULL distingue "sin clasificar"
 * de "clasificado como otros", y esa diferencia es la que le permite al cliente
 * saber cuáles le faltan por revisar.
 *
 * `ADD COLUMN` nullable en Postgres no reescribe la tabla ni toca una sola fila
 * existente: es un cambio de catálogo. Ninguna otra columna se modifica.
 */
export class AddMaterialTipo1783500000000 implements MigrationInterface {
  name = 'AddMaterialTipo1783500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "materiales" ADD "tipo" character varying(20)`,
    );
    // La tabla se filtra por tipo en cada carga de la pantalla de Ajustes.
    await queryRunner.query(
      `CREATE INDEX "IDX_materiales_tipo" ON "materiales" ("tipo")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_materiales_tipo"`);
    await queryRunner.query(`ALTER TABLE "materiales" DROP COLUMN "tipo"`);
  }
}

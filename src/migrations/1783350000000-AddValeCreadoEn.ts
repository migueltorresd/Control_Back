import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Hora exacta del alta del vale. `vales.fecha` es `date` (solo el día), así que
 * la hora nunca se guardó.
 *
 * La columna se agrega SIN default y recién después se le pone `now()`. Hacerlo
 * en un solo `ADD COLUMN ... DEFAULT now()` haría que Postgres rellene las filas
 * existentes con la hora de la migración: todos los vales viejos quedarían
 * "creados" el mismo minuto. Prefiero NULL, que dice la verdad: no se sabe.
 */
export class AddValeCreadoEn1783350000000 implements MigrationInterface {
  name = 'AddValeCreadoEn1783350000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "vales" ADD "creadoEn" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "vales" ALTER COLUMN "creadoEn" SET DEFAULT now()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "vales" DROP COLUMN "creadoEn"`);
  }
}

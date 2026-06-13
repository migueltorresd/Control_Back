import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Consistencia de dominio: dinero a numeric, fechas a date, Pago.etapa a enum.
 * Usa ALTER COLUMN ... TYPE ... USING para CONVERTIR los datos existentes,
 * nunca DROP+ADD (que los perdería). Los valores actuales de etapa ('Cortador'
 * etc.) ya coinciden con el enum Oficio, así que la conversión es directa.
 */
export class DomainConsistency1781353676977 implements MigrationInterface {
  name = 'DomainConsistency1781353676977';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // materiales.precio: float -> numeric(12,2)
    await queryRunner.query(
      `ALTER TABLE "materiales" ALTER COLUMN "precio" TYPE numeric(12,2) USING "precio"::numeric(12,2)`,
    );

    // fechas: varchar -> date (conserva los valores YYYY-MM-DD)
    await queryRunner.query(
      `ALTER TABLE "vales" ALTER COLUMN "fecha" TYPE date USING "fecha"::date`,
    );
    await queryRunner.query(
      `ALTER TABLE "pagos" ALTER COLUMN "fecha" TYPE date USING "fecha"::date`,
    );
    await queryRunner.query(
      `ALTER TABLE "ventas" ALTER COLUMN "fecha" TYPE date USING "fecha"::date`,
    );

    // pagos.etapa: varchar -> enum (los valores existentes ya son válidos)
    await queryRunner.query(
      `CREATE TYPE "public"."pagos_etapa_enum" AS ENUM('Cortador', 'Guarnecedor', 'Solador', 'Finizaje')`,
    );
    await queryRunner.query(
      `ALTER TABLE "pagos" ALTER COLUMN "etapa" TYPE "public"."pagos_etapa_enum" USING "etapa"::"public"."pagos_etapa_enum"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "pagos" ALTER COLUMN "etapa" TYPE character varying USING "etapa"::text`,
    );
    await queryRunner.query(`DROP TYPE "public"."pagos_etapa_enum"`);

    await queryRunner.query(
      `ALTER TABLE "ventas" ALTER COLUMN "fecha" TYPE character varying USING "fecha"::text`,
    );
    await queryRunner.query(
      `ALTER TABLE "pagos" ALTER COLUMN "fecha" TYPE character varying USING "fecha"::text`,
    );
    await queryRunner.query(
      `ALTER TABLE "vales" ALTER COLUMN "fecha" TYPE character varying USING "fecha"::text`,
    );

    await queryRunner.query(
      `ALTER TABLE "materiales" ALTER COLUMN "precio" TYPE double precision USING "precio"::double precision`,
    );
  }
}

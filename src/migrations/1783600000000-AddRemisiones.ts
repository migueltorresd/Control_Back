import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Remisiones: el documento comercial que acompaña la mercancía que sale.
 *
 * La remisión guarda solo la cabecera —a quién se le entrega, cómo paga y con
 * qué número de talonario—. Sus renglones NO son una tabla nueva: son las
 * ventas que ya existen, que se le cuelgan por `remisionId`.
 *
 * Esa decisión es deliberada. El stock del taller se calcula como
 * `fabricados - vendidos`; si la remisión tuviera renglones propios habría dos
 * caminos distintos sacando pares del depósito, y el día que alguien registre
 * una venta sin remisión los dos números se contradicen. Con una sola fuente,
 * eso no puede pasar.
 *
 * `remisionId` es nullable y sin backfill: las ventas ya cargadas se hicieron
 * antes de que existiera el documento, y ponerles una remisión inventada sería
 * afirmar que se emitió un papel que nadie firmó. NULL dice la verdad: esa
 * venta no tiene remisión.
 *
 * `ADD COLUMN` nullable en Postgres no reescribe la tabla ni toca una sola fila
 * existente: es un cambio de catálogo.
 */
export class AddRemisiones1783600000000 implements MigrationInterface {
  name = 'AddRemisiones1783600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "remisiones" (
        "numero" character varying NOT NULL,
        "fecha" date NOT NULL,
        "clienteNombre" character varying(160) NOT NULL,
        "clienteDocumento" character varying(40),
        "clienteDireccion" character varying(200),
        "formaPago" character varying(20) NOT NULL,
        "observaciones" text,
        CONSTRAINT "PK_remisiones_numero" PRIMARY KEY ("numero")
      )
    `);

    // Mismo mecanismo que vales, ventas y pagos: el consecutivo lo da Postgres,
    // no la aplicación, para que dos usuarios simultáneos no reciban el mismo.
    // Arranca en 1 (REM-0001): la numeración del sistema es su propia serie y
    // no continúa la del talonario de papel. Son dos libros distintos.
    await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS remisiones_seq`);

    await queryRunner.query(
      `ALTER TABLE "ventas" ADD "remisionId" character varying`,
    );

    // Al borrar una remisión las ventas sobreviven sin ella: la mercancía salió
    // igual, y perder el registro de la salida descuadraría el stock.
    await queryRunner.query(`
      ALTER TABLE "ventas"
      ADD CONSTRAINT "FK_ventas_remision"
      FOREIGN KEY ("remisionId") REFERENCES "remisiones"("numero")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    // La ficha de una remisión pide todos sus renglones de una.
    await queryRunner.query(
      `CREATE INDEX "IDX_ventas_remision" ON "ventas" ("remisionId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_ventas_remision"`);
    await queryRunner.query(
      `ALTER TABLE "ventas" DROP CONSTRAINT "FK_ventas_remision"`,
    );
    await queryRunner.query(`ALTER TABLE "ventas" DROP COLUMN "remisionId"`);
    await queryRunner.query(`DROP SEQUENCE IF EXISTS remisiones_seq`);
    await queryRunner.query(`DROP TABLE "remisiones"`);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Anulación de ventas y remisiones, con el mismo rastro que ya tienen los vales.
 *
 * Acá nada se borra: una salida de mercancía que se deshace tiene que quedar
 * registrada, con motivo y firma, o el inventario pierde su historia.
 *
 * `estado` entra con DEFAULT 'activo' y NOT NULL, igual que en `vales`: el
 * default afirma algo verdadero, porque toda venta y toda remisión que existe
 * hoy está vigente —ninguna pudo anularse antes de que la anulación existiera—.
 *
 * El resto queda nullable y sin backfill: una venta vigente no tiene motivo de
 * anulación, y ponerle uno sería inventar una baja que nadie hizo.
 *
 * OJO con el efecto en el stock: `valeStock` se calcula como
 * `fabricados - vendidos`, así que a partir de acá el conteo de vendidos debe
 * ignorar las ventas anuladas. Si no, anular no devolvería la mercancía al
 * depósito y el número mentiría.
 */
export class AddAnulacionVentasRemisiones1783650000000 implements MigrationInterface {
  name = 'AddAnulacionVentasRemisiones1783650000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const tabla of ['ventas', 'remisiones']) {
      await queryRunner.query(
        `ALTER TABLE "${tabla}" ADD "estado" character varying(20) NOT NULL DEFAULT 'activo'`,
      );
      await queryRunner.query(
        `ALTER TABLE "${tabla}" ADD "anuladoEn" TIMESTAMP WITH TIME ZONE`,
      );
      await queryRunner.query(
        `ALTER TABLE "${tabla}" ADD "anuladoPorId" character varying`,
      );
      await queryRunner.query(
        `ALTER TABLE "${tabla}" ADD "motivoAnulacion" character varying(300)`,
      );

      // RESTRICT, igual que en vales: un administrativo que anuló algo no se
      // borra nunca, se desactiva.
      await queryRunner.query(
        `ALTER TABLE "${tabla}" ADD CONSTRAINT "FK_${tabla}_anuladoPorId" ` +
          `FOREIGN KEY ("anuladoPorId") REFERENCES "administrativos"("id") ` +
          `ON DELETE RESTRICT ON UPDATE NO ACTION`,
      );

      // Los listados filtran por estado en cada carga.
      await queryRunner.query(
        `CREATE INDEX "IDX_${tabla}_estado" ON "${tabla}" ("estado")`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const tabla of ['ventas', 'remisiones']) {
      await queryRunner.query(`DROP INDEX "IDX_${tabla}_estado"`);
      await queryRunner.query(
        `ALTER TABLE "${tabla}" DROP CONSTRAINT "FK_${tabla}_anuladoPorId"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${tabla}" DROP COLUMN "motivoAnulacion"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${tabla}" DROP COLUMN "anuladoPorId"`,
      );
      await queryRunner.query(`ALTER TABLE "${tabla}" DROP COLUMN "anuladoEn"`);
      await queryRunner.query(`ALTER TABLE "${tabla}" DROP COLUMN "estado"`);
    }
  }
}

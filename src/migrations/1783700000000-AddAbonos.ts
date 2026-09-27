import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Abonos a las remisiones a crédito: la plata que ENTRA desde los clientes.
 *
 * No se confunde con `pagos`, que es la que SALE hacia los operarios. Son flujos
 * opuestos y mezclarlos en una tabla haría que cualquier suma de caja mintiera.
 *
 * El SALDO NO SE GUARDA. Sale de `total de la remisión - suma de sus abonos
 * vigentes`, calculado cada vez. Una columna `saldo` se desincroniza con sus
 * abonos al primer error de escritura, y a partir de ahí hay dos números que se
 * contradicen sin que nadie sepa cuál creer. El total tampoco se guarda: ya sale
 * de los renglones.
 *
 * Los abonos se anulan, no se borran: un abono mal cargado hay que poder
 * corregirlo, pero el rastro de que alguien lo registró tiene que quedar. Mismo
 * criterio que ventas y remisiones.
 */
export class AddAbonos1783700000000 implements MigrationInterface {
  name = 'AddAbonos1783700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "abonos" (
        "id" character varying NOT NULL,
        "remisionId" character varying NOT NULL,
        "fecha" date NOT NULL,
        "monto" numeric(12,2) NOT NULL,
        "metodo" character varying(20) NOT NULL,
        "observaciones" text,
        "registradoPorId" character varying,
        "creadoEn" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "estado" character varying(20) NOT NULL DEFAULT 'activo',
        "anuladoEn" TIMESTAMP WITH TIME ZONE,
        "anuladoPorId" character varying,
        "motivoAnulacion" character varying(300),
        CONSTRAINT "PK_abonos_id" PRIMARY KEY ("id")
      )
    `);

    // Mismo mecanismo que vales, ventas, pagos y remisiones: el consecutivo lo
    // da Postgres, no la aplicación.
    await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS abonos_seq`);

    // RESTRICT: una remisión con abonos registrados no se borra. Y de hecho no
    // se borra ninguna —se anulan—, pero la FK lo deja escrito en el esquema.
    await queryRunner.query(`
      ALTER TABLE "abonos"
      ADD CONSTRAINT "FK_abonos_remision"
      FOREIGN KEY ("remisionId") REFERENCES "remisiones"("numero")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    for (const col of ['registradoPorId', 'anuladoPorId']) {
      await queryRunner.query(`
        ALTER TABLE "abonos"
        ADD CONSTRAINT "FK_abonos_${col}"
        FOREIGN KEY ("${col}") REFERENCES "administrativos"("id")
        ON DELETE RESTRICT ON UPDATE NO ACTION
      `);
    }

    // El saldo de una remisión se calcula sumando sus abonos: se consulta por
    // remisión en cada carga de la pantalla.
    await queryRunner.query(
      `CREATE INDEX "IDX_abonos_remision" ON "abonos" ("remisionId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_abonos_estado" ON "abonos" ("estado")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_abonos_estado"`);
    await queryRunner.query(`DROP INDEX "IDX_abonos_remision"`);
    await queryRunner.query(`DROP SEQUENCE IF EXISTS abonos_seq`);
    await queryRunner.query(`DROP TABLE "abonos"`);
  }
}

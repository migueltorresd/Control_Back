import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRechazo1781268064383 implements MigrationInterface {
  name = 'AddRechazo1781268064383';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "rechazos" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "fecha" date NOT NULL, "valeId" character varying NOT NULL, "etapa" character varying NOT NULL, "operarioId" character varying NOT NULL, "pares" integer NOT NULL, "motivo" character varying(200) NOT NULL, "registroId" uuid, "creadoEn" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_9ed68530c7d5f893b3f355d2098" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "produccion_registros" ADD "revisadoPor" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "produccion_registros" ADD "revisadoEn" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "rechazos" ADD CONSTRAINT "FK_a29f98989354b8e7d83a7d23220" FOREIGN KEY ("valeId") REFERENCES "vales"("vale") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "rechazos" ADD CONSTRAINT "FK_436f2e3c97657b11f4a40cb8b61" FOREIGN KEY ("operarioId") REFERENCES "operarios"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "rechazos" ADD CONSTRAINT "FK_f7c228ccccb0938e4f7ba303d6b" FOREIGN KEY ("registroId") REFERENCES "produccion_registros"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "rechazos" DROP CONSTRAINT "FK_f7c228ccccb0938e4f7ba303d6b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rechazos" DROP CONSTRAINT "FK_436f2e3c97657b11f4a40cb8b61"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rechazos" DROP CONSTRAINT "FK_a29f98989354b8e7d83a7d23220"`,
    );
    await queryRunner.query(
      `ALTER TABLE "produccion_registros" DROP COLUMN "revisadoEn"`,
    );
    await queryRunner.query(
      `ALTER TABLE "produccion_registros" DROP COLUMN "revisadoPor"`,
    );
    await queryRunner.query(`DROP TABLE "rechazos"`);
  }
}

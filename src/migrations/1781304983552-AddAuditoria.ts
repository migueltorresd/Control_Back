import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuditoria1781304983552 implements MigrationInterface {
  name = 'AddAuditoria1781304983552';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "auditorias" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "fecha" TIMESTAMP NOT NULL DEFAULT now(), "usuario" character varying NOT NULL, "accion" character varying NOT NULL, "entidad" character varying NOT NULL, "entidadId" character varying NOT NULL, "detalle" jsonb NOT NULL, CONSTRAINT "PK_b84b3505f313ab1a44e7b684ee2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "produccion_registros" DROP COLUMN "estado"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."produccion_registros_estado_enum" AS ENUM('registrado', 'aprobado', 'pagado')`,
    );
    await queryRunner.query(
      `ALTER TABLE "produccion_registros" ADD "estado" "public"."produccion_registros_estado_enum" NOT NULL DEFAULT 'registrado'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "produccion_registros" DROP COLUMN "estado"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."produccion_registros_estado_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "produccion_registros" ADD "estado" character varying NOT NULL DEFAULT 'registrado'`,
    );
    await queryRunner.query(`DROP TABLE "auditorias"`);
  }
}

import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUsuarios1781232962762 implements MigrationInterface {
    name = 'AddUsuarios1781232962762'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "usuarios" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "username" character varying NOT NULL, "passwordHash" character varying NOT NULL, "rol" character varying NOT NULL, "operarioId" character varying, "activo" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_9f78cfde576fc28f279e2b7a9cb" UNIQUE ("username"), CONSTRAINT "PK_d7281c63c176e152e4c531594a8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "usuarios" ADD CONSTRAINT "FK_5f7a180fcaa6600ca0da23aaaf6" FOREIGN KEY ("operarioId") REFERENCES "operarios"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "usuarios" DROP CONSTRAINT "FK_5f7a180fcaa6600ca0da23aaaf6"`);
        await queryRunner.query(`DROP TABLE "usuarios"`);
    }

}

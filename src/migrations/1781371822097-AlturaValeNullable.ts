import { MigrationInterface, QueryRunner } from "typeorm";

export class AlturaValeNullable1781371822097 implements MigrationInterface {
    name = 'AlturaValeNullable1781371822097'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vales" ALTER COLUMN "altura" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vales" ALTER COLUMN "altura" SET NOT NULL`);
    }

}

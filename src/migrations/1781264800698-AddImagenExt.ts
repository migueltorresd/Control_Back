import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddImagenExt1781264800698 implements MigrationInterface {
  name = 'AddImagenExt1781264800698';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "referencias" ADD "imagenExt" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "referencias" DROP COLUMN "imagenExt"`,
    );
  }
}

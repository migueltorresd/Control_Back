import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Revocación de sesiones: cada usuario lleva una versión de sesión que viaja
 * en el JWT. Si la versión del token no coincide con la de la BD, el token
 * queda inválido — cambiar la contraseña incrementa la versión y mata todas
 * las sesiones activas al instante.
 */
export class AddTokenVersion1783150000000 implements MigrationInterface {
  name = 'AddTokenVersion1783150000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "usuarios" ADD "tokenVersion" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "usuarios" DROP COLUMN "tokenVersion"`,
    );
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Contraseñas temporales con vencimiento y cambio obligatorio (OWASP ASVS
 * 2.5.x y Forgot Password Cheat Sheet).
 *
 * Sin esto, la clave que un administrador genera para rescatar una cuenta vive
 * para siempre: deja de ser "temporal" y pasa a ser una contraseña permanente
 * que un tercero conoce. Además, cualquier acción del dueño de la cuenta queda
 * registrada a su nombre aunque la haya hecho quien generó la clave.
 *
 * Las cuentas existentes quedan con `debeCambiarPassword = false`: su
 * contraseña la eligió su dueño, no hay nada que forzar.
 */
export class AddPasswordTemporal1783400000000 implements MigrationInterface {
  name = 'AddPasswordTemporal1783400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "usuarios" ADD "debeCambiarPassword" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "usuarios" ADD "passwordTemporalExpiraEn" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "usuarios" DROP COLUMN "passwordTemporalExpiraEn"`,
    );
    await queryRunner.query(
      `ALTER TABLE "usuarios" DROP COLUMN "debeCambiarPassword"`,
    );
  }
}

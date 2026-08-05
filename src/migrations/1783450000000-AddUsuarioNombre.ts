import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Nombre real de la persona, separado del `username` con el que inicia sesión.
 *
 * El username es una credencial: corto, sin espacios, cómodo de tipear en el
 * taller (`j.tacuma`). El nombre es cómo se le habla a la persona en pantalla
 * ("Jhon Tacuma"). Meterlos en la misma columna obliga a elegir entre una
 * credencial incómoda o un saludo que no parece dirigido a nadie.
 *
 * Nullable: las cuentas que ya existen no tienen nombre cargado, y la interfaz
 * cae al username cuando falta.
 */
export class AddUsuarioNombre1783450000000 implements MigrationInterface {
  name = 'AddUsuarioNombre1783450000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "usuarios" ADD "nombre" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "usuarios" DROP COLUMN "nombre"`);
  }
}

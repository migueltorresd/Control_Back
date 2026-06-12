import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSequences1781230143161 implements MigrationInterface {
    name = 'AddSequences1781230143161'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // --- Secuencia para vales (ID presentación: V-0001) ---
        await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS vales_seq`);
        // setval con is_called=false: el próximo nextval devuelve exactamente ese valor.
        // Así una BD vacía empieza en V-0001 (no en V-0002).
        await queryRunner.query(`
            SELECT setval(
                'vales_seq',
                COALESCE((
                    SELECT MAX(substring(vale FROM 3)::int)
                    FROM vales
                    WHERE vale ~ '^V-[0-9]+$'
                ), 0) + 1,
                false
            )
        `);

        // --- Secuencia para ventas (ID presentación: VT-0001) ---
        await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS ventas_seq`);
        await queryRunner.query(`
            SELECT setval(
                'ventas_seq',
                COALESCE((
                    SELECT MAX(substring(id FROM 4)::int)
                    FROM ventas
                    WHERE id ~ '^VT-[0-9]+$'
                ), 0) + 1,
                false
            )
        `);

        // --- Secuencia para pagos (ID presentación: PG-0001) ---
        await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS pagos_seq`);
        await queryRunner.query(`
            SELECT setval(
                'pagos_seq',
                COALESCE((
                    SELECT MAX(substring(id FROM 4)::int)
                    FROM pagos
                    WHERE id ~ '^PG-[0-9]+$'
                ), 0) + 1,
                false
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP SEQUENCE IF EXISTS pagos_seq`);
        await queryRunner.query(`DROP SEQUENCE IF EXISTS ventas_seq`);
        await queryRunner.query(`DROP SEQUENCE IF EXISTS vales_seq`);
    }
}

import 'dotenv/config';
import { DataSource } from 'typeorm';
import { InitialSchema1781228207360 } from '../../src/migrations/1781228207360-InitialSchema';
import { AddSequences1781230143161 } from '../../src/migrations/1781230143161-AddSequences';
import { AddUsuarios1781232962762 } from '../../src/migrations/1781232962762-AddUsuarios';
import { AddImagenExt1781264800698 } from '../../src/migrations/1781264800698-AddImagenExt';
import { AddRechazo1781268064383 } from '../../src/migrations/1781268064383-AddRechazo';

/** Base de datos dedicada para e2e — nunca la de desarrollo. */
export const TEST_DB = 'control_produccion_test';

const conexionBase = {
  type: 'postgres' as const,
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT),
  username: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
};

/**
 * Deja la BD de test lista y repetible:
 * 1. La crea si no existe (conexión administrativa a la BD 'postgres').
 * 2. Recrea el esquema desde cero.
 * 3. Corre todas las migraciones (importadas explícitamente: TypeORM no
 *    puede cargar globs de .ts bajo jest).
 */
export async function prepararBaseDeDatosDeTest(): Promise<void> {
  const admin = new DataSource({ ...conexionBase, database: 'postgres' });
  await admin.initialize();
  const existe: unknown[] = await admin.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [TEST_DB],
  );
  if (existe.length === 0) {
    // TEST_DB es una constante del código, no input externo
    await admin.query(`CREATE DATABASE ${TEST_DB}`);
  }
  await admin.destroy();

  const ds = new DataSource({
    ...conexionBase,
    database: TEST_DB,
    migrations: [
      InitialSchema1781228207360,
      AddSequences1781230143161,
      AddUsuarios1781232962762,
      AddImagenExt1781264800698,
      AddRechazo1781268064383,
    ],
  });
  await ds.initialize();
  await ds.query('DROP SCHEMA public CASCADE');
  await ds.query('CREATE SCHEMA public');
  await ds.runMigrations();
  await ds.destroy();
}

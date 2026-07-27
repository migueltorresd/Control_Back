import 'dotenv/config';
import { DataSource } from 'typeorm';
import { InitialSchema1781228207360 } from '../../src/migrations/1781228207360-InitialSchema';
import { AddSequences1781230143161 } from '../../src/migrations/1781230143161-AddSequences';
import { AddUsuarios1781232962762 } from '../../src/migrations/1781232962762-AddUsuarios';
import { AddImagenExt1781264800698 } from '../../src/migrations/1781264800698-AddImagenExt';
import { AddRechazo1781268064383 } from '../../src/migrations/1781268064383-AddRechazo';
import { AddAuditoria1781304983552 } from '../../src/migrations/1781304983552-AddAuditoria';
import { DomainConsistency1781353676977 } from '../../src/migrations/1781353676977-DomainConsistency';
import { AlturaValeNullable1781371822097 } from '../../src/migrations/1781371822097-AlturaValeNullable';
import { AddReferenciaImagenes1782950400000 } from '../../src/migrations/1782950400000-AddReferenciaImagenes';
import { AddTokenVersion1783150000000 } from '../../src/migrations/1783150000000-AddTokenVersion';

/** Base de datos dedicada para e2e — nunca la de desarrollo. */
export const TEST_DB = 'control_produccion_test';

/**
 * URL de la BD de test armada con las mismas variables sueltas que usa este
 * módulo. El e2e la fuerza en DATABASE_URL para que la app bajo prueba JAMÁS
 * use una URL del entorno (que podría apuntar a la base de producción).
 */
export function urlBaseDeDatosDeTest(): string {
  const user = encodeURIComponent(process.env.DATABASE_USERNAME ?? '');
  const pass = encodeURIComponent(process.env.DATABASE_PASSWORD ?? '');
  const host = process.env.DATABASE_HOST ?? 'localhost';
  const port = process.env.DATABASE_PORT ?? '5432';
  return `postgresql://${user}:${pass}@${host}:${port}/${TEST_DB}`;
}

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
      AddAuditoria1781304983552,
      DomainConsistency1781353676977,
      AlturaValeNullable1781371822097,
      AddReferenciaImagenes1782950400000,
      AddTokenVersion1783150000000,
    ],
  });
  await ds.initialize();
  await ds.query('DROP SCHEMA public CASCADE');
  await ds.query('CREATE SCHEMA public');
  await ds.runMigrations();
  await ds.destroy();
}

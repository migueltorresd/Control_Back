import 'dotenv/config';
import { DataSource } from 'typeorm';

/**
 * DataSource para el CLI de TypeORM (migration:generate, migration:run, migration:revert).
 * NO se usa en tiempo de ejecución de la app — el módulo TypeOrmModule.forRootAsync
 * en app.module.ts es el que gestiona la conexión en runtime.
 *
 * Dual dev/prod: en desarrollo este archivo es `.ts` (ts-node) y apunta a `src/`;
 * compilado en producción es `.js` y apunta a `dist/`. Así `migration:run:prod`
 * funciona dentro del contenedor sin necesitar ts-node ni el código fuente.
 */
const esCompilado = __filename.endsWith('.js');
const base = esCompilado ? 'dist' : 'src';
const ext = esCompilado ? 'js' : 'ts';

// Si hay DATABASE_URL (p. ej. Neon en Render) se usa esa cadena; si no, las variables sueltas (Docker/local).
const url = process.env.DATABASE_URL;
// TLS: explícito con DATABASE_SSL=true, o automático si la URI trae sslmode=require.
const ssl =
  process.env.DATABASE_SSL === 'true' || url?.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : false;

export const AppDataSource = new DataSource({
  type: 'postgres',
  ...(url
    ? { url }
    : {
        host: process.env.DATABASE_HOST,
        port: Number(process.env.DATABASE_PORT),
        username: process.env.DATABASE_USERNAME,
        password: process.env.DATABASE_PASSWORD,
        database: process.env.DATABASE_DATABASE,
      }),
  ssl,
  entities: [`${base}/**/*.entity.${ext}`],
  migrations: [`${base}/migrations/*.${ext}`],
  synchronize: false,
});

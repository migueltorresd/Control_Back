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

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT),
  username: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_DATABASE,
  // Render (y otros Postgres gestionados) exigen TLS. Se activa con DATABASE_SSL=true.
  ssl:
    process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  entities: [`${base}/**/*.entity.${ext}`],
  migrations: [`${base}/migrations/*.${ext}`],
  synchronize: false,
});

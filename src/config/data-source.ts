import 'dotenv/config';
import { DataSource } from 'typeorm';

/**
 * DataSource para el CLI de TypeORM (migration:generate, migration:run, migration:revert).
 * NO se usa en tiempo de ejecución de la app — el módulo TypeOrmModule.forRootAsync
 * en app.module.ts es el que gestiona la conexión en runtime.
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT),
  username: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_DATABASE,
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
});

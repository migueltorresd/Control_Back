import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';

import { envValidationSchema } from './config/env.validation';

// Autenticación (guards globales fail-closed)
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';

// Interceptor global
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

// Módulos de negocio
import { MaterialesModule } from './modules/materiales/materiales.module';
import { ReferenciasModule } from './modules/referencias/referencias.module';
import { OperariosModule } from './modules/operarios/operarios.module';
import { ValesModule } from './modules/vales/vales.module';
import { PagosModule } from './modules/pagos/pagos.module';
import { VentasModule } from './modules/ventas/ventas.module';
import { AuditoriaModule } from './modules/auditoria/auditoria.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        // Si hay DATABASE_URL (p. ej. Neon en Render) se usa esa cadena; si no, las variables sueltas (Docker/local).
        const url = config.get<string>('DATABASE_URL');
        // TLS: explícito con DATABASE_SSL=true, o automático si la URI trae sslmode=require.
        const ssl =
          config.get<boolean>('DATABASE_SSL') ||
          url?.includes('sslmode=require')
            ? { rejectUnauthorized: false }
            : false;
        return {
          type: 'postgres',
          ...(url
            ? { url }
            : {
                host: config.get<string>('DATABASE_HOST'),
                port: config.get<number>('DATABASE_PORT'),
                username: config.get<string>('DATABASE_USERNAME'),
                password: config.get<string>('DATABASE_PASSWORD'),
                database: config.get<string>('DATABASE_DATABASE'),
              }),
          ssl,
          autoLoadEntities: true,
          synchronize: false, // NUNCA true — el esquema evoluciona solo por migraciones
          migrationsRun: false, // Las migraciones se corren manualmente: pnpm migration:run
        };
      },
    }),
    // Rate limiting global: 100 requests/minuto por IP
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    AuthModule,
    MaterialesModule,
    ReferenciasModule,
    OperariosModule,
    ValesModule,
    PagosModule,
    VentasModule,
    AuditoriaModule,
    HealthModule,
  ],
  controllers: [],
  providers: [
    // Rate limiting antes de autenticar (protege también el login)
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Fail-closed: primero autenticación, luego autorización por rol
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    // Logger global HTTP
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}

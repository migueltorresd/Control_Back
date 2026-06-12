import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';

import { envValidationSchema } from './config/env.validation';

// Autenticación (guards globales fail-closed)
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';

// Módulos de negocio
import { MaterialesModule } from './modules/materiales/materiales.module';
import { ReferenciasModule } from './modules/referencias/referencias.module';
import { OperariosModule } from './modules/operarios/operarios.module';
import { ValesModule } from './modules/vales/vales.module';
import { PagosModule } from './modules/pagos/pagos.module';
import { VentasModule } from './modules/ventas/ventas.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DATABASE_HOST'),
        port: config.get<number>('DATABASE_PORT'),
        username: config.get<string>('DATABASE_USERNAME'),
        password: config.get<string>('DATABASE_PASSWORD'),
        database: config.get<string>('DATABASE_DATABASE'),
        autoLoadEntities: true,
        synchronize: false, // NUNCA true — el esquema evoluciona solo por migraciones
        migrationsRun: false, // Las migraciones se corren manualmente: pnpm migration:run
      }),
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
  ],
  controllers: [],
  providers: [
    // Rate limiting antes de autenticar (protege también el login)
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Fail-closed: primero autenticación, luego autorización por rol
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { envValidationSchema } from './config/env.validation';

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
    MaterialesModule,
    ReferenciasModule,
    OperariosModule,
    ValesModule,
    PagosModule,
    VentasModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}

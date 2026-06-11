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

// Entidades para SeedService
import { Material } from './modules/materiales/entities/material.entity';
import { Referencia } from './modules/referencias/entities/referencia.entity';
import { Operario } from './modules/operarios/entities/operario.entity';
import { Vale } from './modules/vales/entities/vale.entity';
import { ProduccionReg } from './modules/vales/entities/produccion-reg.entity';
import { Venta } from './modules/ventas/entities/venta.entity';
import { Pago } from './modules/pagos/entities/pago.entity';

// Services
import { SeedService } from './services/seed.service';

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
        synchronize: true, // Se elimina en tarea 1.2 al implementar migraciones
      }),
    }),
    TypeOrmModule.forFeature([Material, Referencia, Operario, Vale, ProduccionReg, Venta, Pago]),
    MaterialesModule,
    ReferenciasModule,
    OperariosModule,
    ValesModule,
    PagosModule,
    VentasModule,
  ],
  controllers: [],
  providers: [SeedService],
})
export class AppModule {}

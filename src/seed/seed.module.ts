import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { envValidationSchema } from '../config/env.validation';
import { SeedService } from './seed.service';

import { Material } from '../modules/materiales/entities/material.entity';
import { Referencia } from '../modules/referencias/entities/referencia.entity';
import { Operario } from '../modules/operarios/entities/operario.entity';
import { Vale } from '../modules/vales/entities/vale.entity';
import { ProduccionReg } from '../modules/vales/entities/produccion-reg.entity';
import { Venta } from '../modules/ventas/entities/venta.entity';
import { Pago } from '../modules/pagos/entities/pago.entity';

// Entidades relacionadas necesarias para las cascadas del seed
import { Tarifa } from '../modules/referencias/entities/tarifa.entity';
import { RecetaItem } from '../modules/referencias/entities/receta-item.entity';
import { ValeTalla } from '../modules/vales/entities/vale-talla.entity';

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
        entities: [Material, Referencia, Tarifa, RecetaItem, Operario, Vale, ValeTalla, ProduccionReg, Venta, Pago],
        synchronize: false,
      }),
    }),
    TypeOrmModule.forFeature([Material, Referencia, Tarifa, RecetaItem, Operario, Vale, ValeTalla, ProduccionReg, Venta, Pago]),
  ],
  providers: [SeedService],
})
export class SeedModule {}

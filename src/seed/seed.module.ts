import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { envValidationSchema } from '../config/env.validation';
import { resolverDbSsl } from '../config/db-ssl';
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
import { Rechazo } from '../modules/vales/entities/rechazo.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('DATABASE_URL');
        const ssl = resolverDbSsl({
          DATABASE_URL: url,
          DATABASE_SSL: config.get<boolean>('DATABASE_SSL'),
          DATABASE_SSL_INSECURE: config.get<boolean>('DATABASE_SSL_INSECURE'),
        });
        return {
          type: 'postgres' as const,
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
          entities: [
            Material,
            Referencia,
            Tarifa,
            RecetaItem,
            Operario,
            Vale,
            ValeTalla,
            ProduccionReg,
            Rechazo,
            Venta,
            Pago,
          ],
          synchronize: false,
        };
      },
    }),
    TypeOrmModule.forFeature([
      Material,
      Referencia,
      Tarifa,
      RecetaItem,
      Operario,
      Vale,
      ValeTalla,
      ProduccionReg,
      Venta,
      Pago,
    ]),
  ],
  providers: [SeedService],
})
export class SeedModule {}

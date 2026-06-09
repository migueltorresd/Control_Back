import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

// Modules nuevos
import { MaterialesModule } from './modules/materiales/materiales.module';
import { ReferenciasModule } from './modules/referencias/referencias.module';
import { OperariosModule } from './modules/operarios/operarios.module';
import { ValesModule } from './modules/vales/vales.module';
import { PagosModule } from './modules/pagos/pagos.module';
import { VentasModule } from './modules/ventas/ventas.module';

// Entities modularizados (para SeedService)
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
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      username: process.env.DATABASE_USERNAME || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'postgres',
      database: process.env.DATABASE_DATABASE || 'control_produccion',
      autoLoadEntities: true, // Carga las entidades registradas en cada módulo automáticamente
      synchronize: true, // Auto-create schemas in development
    }),
    TypeOrmModule.forFeature([Material, Referencia, Operario, Vale, ProduccionReg, Venta, Pago]), // Para uso de SeedService
    MaterialesModule,
    ReferenciasModule,
    OperariosModule,
    ValesModule,
    PagosModule,
    VentasModule,
  ],
  controllers: [],
  providers: [
    SeedService,
  ],
})
export class AppModule {}

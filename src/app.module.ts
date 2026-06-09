import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Entities
import { Material } from './entities/material.entity';
import { Referencia } from './entities/referencia.entity';
import { Operario } from './entities/operario.entity';
import { Vale } from './entities/vale.entity';
import { ProduccionReg } from './entities/produccion-reg.entity';
import { Venta } from './entities/venta.entity';
import { Pago } from './entities/pago.entity';

// Controllers
import { OperariosController } from './controllers/operarios.controller';
import { MaterialesController } from './controllers/materiales.controller';
import { ReferenciasController } from './controllers/referencias.controller';
import { ValesController } from './controllers/vales.controller';
import { VentasController } from './controllers/ventas.controller';
import { PagosController } from './controllers/pagos.controller';

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
      entities: [Material, Referencia, Operario, Vale, ProduccionReg, Venta, Pago],
      synchronize: true, // Auto-create schemas in development
    }),
    TypeOrmModule.forFeature([Material, Referencia, Operario, Vale, ProduccionReg, Venta, Pago]),
  ],
  controllers: [
    AppController,
    OperariosController,
    MaterialesController,
    ReferenciasController,
    ValesController,
    VentasController,
    PagosController,
  ],
  providers: [
    AppService,
    SeedService,
  ],
})
export class AppModule {}

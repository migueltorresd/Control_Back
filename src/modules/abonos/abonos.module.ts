import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Abono } from './entities/abono.entity';
import { AbonosController } from './abonos.controller';
import { AbonosService } from './abonos.service';
import { AbonosRepository } from './abonos.repository';
import { RemisionesModule } from '../remisiones/remisiones.module';
import { AdministrativosModule } from '../administrativos/administrativos.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Abono]),
    // El saldo se calcula contra el total de la remisión, así que el módulo
    // necesita poder leerla.
    forwardRef(() => RemisionesModule),
    AdministrativosModule,
  ],
  controllers: [AbonosController],
  providers: [AbonosService, AbonosRepository],
  exports: [AbonosService, AbonosRepository],
})
export class AbonosModule {}

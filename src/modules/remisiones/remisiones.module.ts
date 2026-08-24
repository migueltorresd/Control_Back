import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Remision } from './entities/remision.entity';
import { RemisionesController } from './remisiones.controller';
import { RemisionesService } from './remisiones.service';
import { RemisionesRepository } from './remisiones.repository';
import { RemisionPdfService } from './remision-pdf.service';
import { VentasModule } from '../ventas/ventas.module';
import { ValesModule } from '../vales/vales.module';
import { AdministrativosModule } from '../administrativos/administrativos.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Remision]),
    // Los renglones de la remisión SON ventas: se reusa su repositorio para
    // que el consecutivo VT- siga saliendo de un solo lugar.
    VentasModule,
    ValesModule,
    AdministrativosModule,
  ],
  controllers: [RemisionesController],
  providers: [RemisionesService, RemisionesRepository, RemisionPdfService],
  exports: [RemisionesService],
})
export class RemisionesModule {}

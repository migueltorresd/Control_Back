import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Remision } from './entities/remision.entity';
import { RemisionesController } from './remisiones.controller';
import { RemisionesService } from './remisiones.service';
import { RemisionesRepository } from './remisiones.repository';
import { RemisionPdfService } from './remision-pdf.service';
import { VentasModule } from '../ventas/ventas.module';
import { ValesModule } from '../vales/vales.module';
import { AdministrativosModule } from '../administrativos/administrativos.module';
import { AbonosModule } from '../abonos/abonos.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Remision]),
    // Los renglones de la remisión SON ventas: se reusa su repositorio para
    // que el consecutivo VT- siga saliendo de un solo lugar.
    VentasModule,
    ValesModule,
    AdministrativosModule,
    // Ciclo real y a propósito: el listado de remisiones muestra el saldo,
    // y el saldo se calcula contra la remisión. forwardRef deja que Nest
    // resuelva los dos lados sin que ninguno tenga que existir primero.
    forwardRef(() => AbonosModule),
  ],
  controllers: [RemisionesController],
  providers: [RemisionesService, RemisionesRepository, RemisionPdfService],
  exports: [RemisionesService],
})
export class RemisionesModule {}

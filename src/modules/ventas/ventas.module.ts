import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Venta } from './entities/venta.entity';
import { VentasController } from './ventas.controller';
import { VentasService } from './ventas.service';
import { VentasRepository } from './ventas.repository';
import { ValesModule } from '../vales/vales.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Venta]),
    ValesModule, // Importa ValesModule para inyectar ValesService
  ],
  controllers: [VentasController],
  providers: [VentasService, VentasRepository],
  exports: [VentasService, VentasRepository],
})
export class VentasModule {}

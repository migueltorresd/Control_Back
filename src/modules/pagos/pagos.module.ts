import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pago } from './entities/pago.entity';
import { PagosController } from './pagos.controller';
import { PagosService } from './pagos.service';
import { PagosRepository } from './pagos.repository';
import { ValesModule } from '../vales/vales.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Pago]),
    ValesModule,
  ],
  controllers: [PagosController],
  providers: [
    PagosService,
    PagosRepository,
  ],
  exports: [
    PagosService,
    PagosRepository,
  ],
})
export class PagosModule {}

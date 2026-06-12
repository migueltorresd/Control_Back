import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vale } from './entities/vale.entity';
import { ValeTalla } from './entities/vale-talla.entity';
import { ProduccionReg } from './entities/produccion-reg.entity';
import { Rechazo } from './entities/rechazo.entity';
import { ValesController } from './vales.controller';
import { RechazosController } from './rechazos.controller';
import { ValesService } from './vales.service';
import { ValesRepository } from './vales.repository';
import { ProduccionService } from './produccion.service';
import { ProduccionRepository } from './produccion.repository';
import { ReferenciasModule } from '../referencias/referencias.module';
import { OperariosModule } from '../operarios/operarios.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Vale, ValeTalla, ProduccionReg, Rechazo]),
    ReferenciasModule,
    OperariosModule,
  ],
  controllers: [ValesController, RechazosController],
  providers: [
    ValesService,
    ValesRepository,
    ProduccionService,
    ProduccionRepository,
  ],
  exports: [
    ValesService,
    ValesRepository,
    ProduccionService,
    ProduccionRepository,
  ],
})
export class ValesModule {}

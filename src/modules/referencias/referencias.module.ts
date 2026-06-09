import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Referencia } from './entities/referencia.entity';
import { Tarifa } from './entities/tarifa.entity';
import { RecetaItem } from './entities/receta-item.entity';
import { ReferenciasController } from './referencias.controller';
import { ReferenciasService } from './referencias.service';
import { ReferenciasRepository } from './referencias.repository';
import { MaterialesModule } from '../materiales/materiales.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Referencia, Tarifa, RecetaItem]),
    MaterialesModule, // Importado para usar el MaterialesService
  ],
  controllers: [ReferenciasController],
  providers: [
    ReferenciasService,
    ReferenciasRepository,
  ],
  exports: [
    ReferenciasService,
    ReferenciasRepository,
  ],
})
export class ReferenciasModule {}

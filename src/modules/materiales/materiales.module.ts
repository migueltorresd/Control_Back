import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Material } from './entities/material.entity';
import { MaterialesController } from './materiales.controller';
import { MaterialesService } from './materiales.service';
import { MaterialesRepository } from './materiales.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([Material]),
  ],
  controllers: [MaterialesController],
  providers: [
    MaterialesService,
    MaterialesRepository,
  ],
  exports: [
    MaterialesService,
    MaterialesRepository,
  ],
})
export class MaterialesModule {}

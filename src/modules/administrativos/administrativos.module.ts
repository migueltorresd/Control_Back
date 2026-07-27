import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Administrativo } from './entities/administrativo.entity';
import { AdministrativosController } from './administrativos.controller';
import { AdministrativosService } from './administrativos.service';
import { AdministrativosRepository } from './administrativos.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Administrativo])],
  controllers: [AdministrativosController],
  providers: [AdministrativosService, AdministrativosRepository],
  exports: [AdministrativosService, AdministrativosRepository],
})
export class AdministrativosModule {}

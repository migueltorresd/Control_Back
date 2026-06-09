import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Operario } from './entities/operario.entity';
import { OperariosController } from './operarios.controller';
import { OperariosService } from './operarios.service';
import { OperariosRepository } from './operarios.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([Operario]),
  ],
  controllers: [OperariosController],
  providers: [
    OperariosService,
    OperariosRepository,
  ],
  exports: [
    OperariosService,
    OperariosRepository,
  ],
})
export class OperariosModule {}

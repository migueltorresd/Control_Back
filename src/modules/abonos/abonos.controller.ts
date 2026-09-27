import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AbonosService } from './abonos.service';
import { CreateAbonoDto } from './dto/create-abono.dto';
import { Abono } from './entities/abono.entity';
import { AnularDto } from '../../common/dto/anular.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../auth/enums/rol.enum';

@ApiTags('Abonos y cartera')
@ApiBearerAuth()
@Controller()
@Roles(Rol.ADMIN)
export class AbonosController {
  constructor(private readonly abonosService: AbonosService) {}

  @Get('remisiones/:numero/abonos')
  @ApiOperation({
    summary: 'Abonos de una remisión y su estado de cuenta (ADMIN)',
  })
  async porRemision(@Param('numero') numero: string) {
    const [abonos, cuenta] = await Promise.all([
      this.abonosService.findByRemision(numero),
      this.abonosService.estadoCuenta(numero),
    ]);
    return { ...cuenta, abonos: abonos.map((a) => this.mapToFrontend(a)) };
  }

  @Post('remisiones/:numero/abonos')
  @ApiOperation({
    summary:
      'Registrar un abono del cliente contra una remisión a crédito (ADMIN). ' +
      'Rechaza montos mayores al saldo y remisiones de contado o anuladas.',
  })
  async crear(@Param('numero') numero: string, @Body() dto: CreateAbonoDto) {
    const abono = await this.abonosService.create(numero, dto);
    return this.mapToFrontend(abono);
  }

  @Post('abonos/:id/anulacion')
  @ApiOperation({
    summary:
      'Anular un abono mal registrado (ADMIN). No se elimina: la deuda vuelve ' +
      'a subir y queda el rastro de quién lo deshizo y por qué.',
  })
  async anular(@Param('id') id: string, @Body() dto: AnularDto) {
    const abono = await this.abonosService.anular(
      id,
      dto.motivo,
      dto.anuladoPorId,
    );
    return this.mapToFrontend(abono);
  }

  private mapToFrontend(a: Abono) {
    return {
      id: a.id,
      remision: a.remisionId,
      fecha: a.fecha,
      monto: a.monto,
      metodo: a.metodo,
      observaciones: a.observaciones,
      registradoPor: a.registradoPor?.nombre ?? null,
      estado: a.estado,
      motivoAnulacion: a.motivoAnulacion,
      anuladoEn: a.anuladoEn,
      anuladoPor: a.anuladoPor?.nombre ?? null,
    };
  }
}

import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AbonosService } from './abonos.service';
import { CarteraService } from './cartera.service';
import { CreateAbonoDto } from './dto/create-abono.dto';
import { AbonarClienteDto } from './dto/abonar-cliente.dto';
import { Abono } from './entities/abono.entity';
import { AnularDto } from '../../common/dto/anular.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../auth/enums/rol.enum';

@ApiTags('Abonos y cartera')
@ApiBearerAuth()
@Controller()
@Roles(Rol.ADMIN)
export class AbonosController {
  constructor(
    private readonly abonosService: AbonosService,
    private readonly carteraService: CarteraService,
  ) {}

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

  @Get('cartera')
  @ApiOperation({
    summary:
      'Clientes con deuda pendiente, del que más debe al que menos (ADMIN). ' +
      'Agrupa ignorando mayúsculas, tildes, puntuación y espacios del nombre.',
  })
  async cartera() {
    return this.carteraService.clientesConDeuda();
  }

  @Get('cartera/:clave')
  @ApiOperation({
    summary:
      'Estado de cuenta de un cliente, con sus remisiones de la más antigua ' +
      'a la más nueva (ADMIN)',
  })
  // La clave llega en la URL y el cliente la manda con encodeURIComponent.
  // Express ya la decodifica al llenar el @Param, así que NO se vuelve a
  // decodificar: un nombre con «%» (por ejemplo «DESCUENTO 10%») haría que
  // decodeURIComponent lance URIError y el endpoint respondiera 500.
  async cuentaCliente(@Param('clave') clave: string) {
    return this.carteraService.cuentaDe(clave);
  }

  @Post('cartera/:clave/abonos')
  @ApiOperation({
    summary:
      'Abonar a un cliente repartiendo entre sus remisiones, de la más ' +
      'antigua a la más nueva (ADMIN). Rechaza montos mayores a la deuda total.',
  })
  async abonarCliente(
    @Param('clave') clave: string,
    @Body() dto: AbonarClienteDto,
  ) {
    return this.carteraService.abonarACliente(
      clave,
      dto.monto,
      dto.metodo,
      dto.registradoPorId,
      dto.observaciones,
      dto.fecha,
    );
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

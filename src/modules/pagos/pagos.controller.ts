import { Controller, Get, Post, Body, Query, Param } from '@nestjs/common';
import { PagosService } from './pagos.service';
import { PagarLoteDto } from './dto/pagar-lote.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../auth/enums/rol.enum';

@Controller('pagos')
@Roles(Rol.ADMIN)
export class PagosController {
  constructor(private readonly pagosService: PagosService) {}

  @Get()
  async findAll(@Query('operarioId') operarioId?: string) {
    const pagos = await this.pagosService.findAll(operarioId);
    // Retornamos mapeado con la estructura que el frontend espera
    return pagos.map((p) => ({
      id: p.id,
      fecha: p.fecha,
      operarioId: p.operarioId,
      vale: p.valeId,
      etapa: p.etapa,
      pares: p.pares,
      monto: p.monto,
      ref: p.refId,
    }));
  }

  @Post('lote')
  async pagarLote(@Body() dto: PagarLoteDto) {
    const result = await this.pagosService.pagarLote(dto.items);
    return { success: true, count: result.length };
  }

  @Post(':regId')
  async pagarIndividual(@Param('regId') regId: string) {
    const pago = await this.pagosService.pagar(regId);
    return {
      success: true,
      pago: {
        id: pago.id,
        fecha: pago.fecha,
        operarioId: pago.operarioId,
        vale: pago.valeId,
        etapa: pago.etapa,
        pares: pago.pares,
        monto: pago.monto,
        ref: pago.refId,
      },
    };
  }

  @Post('anular/:regId')
  async anularPago(@Param('regId') regId: string) {
    await this.pagosService.anularPagoPorRegistro(regId);
    return { success: true };
  }
}

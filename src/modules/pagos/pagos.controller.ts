import { Controller, Get, Post, Body, Query, Param, Req } from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PagosService } from './pagos.service';
import { PagarLoteDto } from './dto/pagar-lote.dto';
import { Pago } from './entities/pago.entity';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../auth/enums/rol.enum';
import { UsuarioAutenticado } from '../auth/jwt.strategy';

@ApiTags('Pagos')
@ApiBearerAuth()
@Controller('pagos')
@Roles(Rol.ADMIN)
export class PagosController {
  constructor(private readonly pagosService: PagosService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener historial de pagos de operarios (ADMIN)' })
  async findAll(
    @Query() query: PaginationQueryDto,
    @Query('operarioId') operarioId?: string,
  ) {
    // Modo paginado opt-in: solo si llegan page/limit/desde/hasta
    if (query.esPaginado) {
      const page = query.page ?? 1;
      const limit = query.limit ?? 50;
      const { data, total } = await this.pagosService.findAllPaginated({
        page,
        limit,
        operarioId,
        desde: query.desde,
        hasta: query.hasta,
      });
      return {
        data: data.map((p) => this.mapToFrontend(p)),
        total,
        page,
        limit,
      };
    }

    // Modo legacy: lista completa (usado por las agregaciones del frontend)
    const pagos = await this.pagosService.findAll(operarioId);
    return pagos.map((p) => this.mapToFrontend(p));
  }

  private mapToFrontend(p: Pago) {
    return {
      id: p.id,
      fecha: p.fecha,
      operarioId: p.operarioId,
      vale: p.valeId,
      etapa: p.etapa,
      pares: p.pares,
      monto: p.monto,
      ref: p.refId,
    };
  }

  @Post('lote')
  @ApiOperation({
    summary: 'Pagar un lote de registros de producción aprobados (ADMIN)',
  })
  async pagarLote(
    @Body() dto: PagarLoteDto,
    @Req() req: Request & { user: UsuarioAutenticado },
  ) {
    const username = req.user?.username ?? undefined;
    const result = await this.pagosService.pagarLote(dto.items, username);
    return { success: true, count: result.length };
  }

  @Post(':regId')
  @ApiOperation({
    summary: 'Pagar un único registro de producción aprobado (ADMIN)',
  })
  async pagarIndividual(
    @Param('regId') regId: string,
    @Req() req: Request & { user: UsuarioAutenticado },
  ) {
    const username = req.user?.username ?? undefined;
    const pago = await this.pagosService.pagar(regId, username);
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
  @ApiOperation({
    summary:
      'Anular un pago realizado y retornar el registro a estado aprobado (ADMIN)',
  })
  async anularPago(
    @Param('regId') regId: string,
    @Req() req: Request & { user: UsuarioAutenticado },
  ) {
    const username = req.user?.username ?? undefined;
    await this.pagosService.anularPagoPorRegistro(regId, username);
    return { success: true };
  }
}

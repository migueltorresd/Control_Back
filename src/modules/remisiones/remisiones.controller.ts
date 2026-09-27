import { Controller, Get, Post, Body, Param, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { RemisionesService } from './remisiones.service';
import { RemisionPdfService } from './remision-pdf.service';
import { CreateRemisionDto } from './dto/create-remision.dto';
import { Remision } from './entities/remision.entity';
import { AnularDto } from '../../common/dto/anular.dto';
import { FormaPago } from '../../common/enums/forma-pago.enum';
import { AbonosRepository } from '../abonos/abonos.repository';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../auth/enums/rol.enum';

@ApiTags('Remisiones')
@ApiBearerAuth()
@Controller('remisiones')
@Roles(Rol.ADMIN)
export class RemisionesController {
  constructor(
    private readonly remisionesService: RemisionesService,
    private readonly remisionPdfService: RemisionPdfService,
    private readonly abonosRepository: AbonosRepository,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Obtener todas las remisiones emitidas (ADMIN)' })
  async findAll() {
    const remisiones = await this.remisionesService.findAll();
    // Una sola consulta agrupada para todos los saldos: pedirlos de a uno
    // sería una query por remisión en cada carga de la pantalla.
    const abonados = await this.abonosRepository.totalesAbonados(
      remisiones.map((r) => r.numero),
    );
    return remisiones.map((r) =>
      this.mapToFrontend(r, abonados.get(r.numero) ?? 0),
    );
  }

  @Get(':numero')
  @ApiOperation({ summary: 'Obtener una remisión con sus renglones (ADMIN)' })
  async findOne(@Param('numero') numero: string) {
    const remision = await this.remisionesService.findOne(numero);
    const abonado = await this.abonosRepository.totalAbonado(numero);
    return this.mapToFrontend(remision, abonado);
  }

  @Get(':numero/pdf')
  @ApiOperation({ summary: 'Descargar la remisión en PDF (ADMIN)' })
  async descargarPdf(@Param('numero') numero: string, @Res() res: Response) {
    const remision = await this.remisionesService.findOne(numero);
    const pdf = await this.remisionPdfService.generar(remision);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="remision-${remision.numero}.pdf"`,
      'Content-Length': pdf.length,
    });
    res.end(pdf);
  }

  @Post()
  @ApiOperation({
    summary:
      'Emitir una remisión y registrar las ventas de sus renglones (ADMIN)',
  })
  async create(@Body() dto: CreateRemisionDto) {
    return this.mapToFrontend(await this.remisionesService.create(dto));
  }

  @Post(':numero/anulacion')
  @ApiOperation({
    summary:
      'Anular una remisión y sus renglones (ADMIN). La remisión no se elimina: ' +
      'los pares vuelven al stock y queda el rastro de quién la anuló y por qué.',
  })
  async anular(@Param('numero') numero: string, @Body() dto: AnularDto) {
    const remision = await this.remisionesService.anular(
      numero,
      dto.motivo,
      dto.anuladoPorId,
    );
    return this.mapToFrontend(remision);
  }

  private mapToFrontend(r: Remision, abonado = 0) {
    const items = (r.items || []).map((v) => ({
      ventaId: v.id,
      vale: v.valeId,
      // Lo que el talonario llama "Referencia (Color)".
      ref: v.vale?.referenciaId || null,
      referencia: v.vale?.referencia?.nombre || null,
      color: v.vale?.color || null,
      cantidad: v.pares,
      valorUnitario: v.precioUnitario,
      valorTotal: parseFloat((v.pares * v.precioUnitario).toFixed(2)),
    }));

    const total = parseFloat(
      items.reduce((a, i) => a + i.valorTotal, 0).toFixed(2),
    );
    const esCredito = r.formaPago === FormaPago.CREDITO;

    return {
      numero: r.numero,
      fecha: r.fecha,
      clienteNombre: r.clienteNombre,
      clienteDocumento: r.clienteDocumento,
      clienteDireccion: r.clienteDireccion,
      formaPago: r.formaPago,
      observaciones: r.observaciones,
      estado: r.estado,
      motivoAnulacion: r.motivoAnulacion,
      anuladoEn: r.anuladoEn,
      items,
      total,
      // Cartera. El saldo NO se guarda: se calcula contra los abonos
      // vigentes cada vez. Las de contado nacen saldadas —se cobraron al
      // emitir—, así que su saldo es cero y no aparecen como deuda.
      abonado,
      saldo: esCredito ? parseFloat((total - abonado).toFixed(2)) : 0,
      saldada: esCredito ? total - abonado <= 0 : true,
    };
  }
}

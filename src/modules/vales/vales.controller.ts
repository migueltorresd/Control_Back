import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { ValesService } from './vales.service';
import { ProduccionService } from './produccion.service';
import { CreateValeDto } from './dto/create-vale.dto';
import { RegisterProduccionDto } from './dto/register-produccion.dto';
import { UpdateProduccionEstadoDto } from './dto/update-produccion-estado.dto';

@Controller('vales')
export class ValesController {
  constructor(
    private readonly valesService: ValesService,
    private readonly produccionService: ProduccionService,
  ) {}

  @Get()
  async findAll() {
    const vales = await this.valesService.findAll();
    return vales.map(v => this.mapToFrontend(v));
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const vale = await this.valesService.findOne(id);
    return this.mapToFrontend(vale);
  }

  @Post()
  async create(@Body() dto: CreateValeDto) {
    const fecha = dto.fecha || new Date().toISOString().split('T')[0];

    const tallasArray = Object.entries(dto.tallas).map(([tallaStr, cant]) => ({
      talla: parseInt(tallaStr, 10),
      cantidad: cant,
    }));

    const created = await this.valesService.create({
      fecha,
      almacen: dto.almacen,
      color: dto.color,
      altura: dto.altura,
      referenciaId: dto.ref,
      tallas: tallasArray,
    });

    return this.mapToFrontend(created);
  }

  @Post(':id/registro')
  async addRegistro(@Param('id') valeId: string, @Body() dto: RegisterProduccionDto) {
    const saved = await this.produccionService.registerProduccion(valeId, dto);
    return {
      id: saved.id,
      operarioId: saved.operarioId,
      pares: saved.pares,
      estado: saved.estado,
    };
  }

  @Patch(':id/registro/:regId')
  async updateRegistro(
    @Param('id') valeId: string,
    @Param('regId') regId: string,
    @Body() dto: UpdateProduccionEstadoDto,
  ) {
    await this.produccionService.updateEstado(valeId, regId, dto.estado);
    return { success: true };
  }

  @Delete(':id/registro/:regId')
  async deleteRegistro(
    @Param('id') valeId: string,
    @Param('regId') regId: string,
  ) {
    await this.produccionService.deleteRegistro(valeId, regId);
    return { success: true };
  }

  private mapToFrontend(v: any) {
    const tallasObj: Record<string, number> = {};
    if (v.tallas && Array.isArray(v.tallas)) {
      v.tallas.forEach((t: any) => {
        tallasObj[t.talla.toString()] = t.cantidad;
      });
    }

    const produccion: Record<string, any[]> = {
      Cortador: [],
      Guarnecedor: [],
      Solador: [],
      Finizaje: [],
    };

    if (v.produccion && Array.isArray(v.produccion)) {
      v.produccion.forEach((r: any) => {
        if (produccion[r.etapa]) {
          produccion[r.etapa].push({
            id: r.id,
            operarioId: r.operarioId,
            pares: r.pares,
            estado: r.estado,
          });
        }
      });
    }

    return {
      vale: v.id,
      fecha: v.fecha,
      almacen: v.almacen,
      ref: v.referenciaId,
      color: v.color,
      altura: v.altura,
      tallas: tallasObj,
      produccion,
    };
  }
}

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { ValesService } from './vales.service';
import { ProduccionService, ResultadoRevision } from './produccion.service';
import { CreateValeDto } from './dto/create-vale.dto';
import { RegisterProduccionDto } from './dto/register-produccion.dto';
import { UpdateProduccionEstadoDto } from './dto/update-produccion-estado.dto';
import { RevisarProduccionDto } from './dto/revisar-produccion.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../auth/enums/rol.enum';
import { UsuarioAutenticado } from '../auth/jwt.strategy';
import { EstadoProduccion } from '../../common/enums/estado-produccion.enum';

@Controller('vales')
@Roles(Rol.ADMIN)
export class ValesController {
  constructor(
    private readonly valesService: ValesService,
    private readonly produccionService: ProduccionService,
  ) {}

  @Get()
  async findAll() {
    const vales = await this.valesService.findAll();
    return vales.map((v) => this.mapToFrontend(v));
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
  async addRegistro(
    @Param('id') valeId: string,
    @Body() dto: RegisterProduccionDto,
  ) {
    const saved = await this.produccionService.registerProduccion(valeId, dto);
    return {
      id: saved.id,
      operarioId: saved.operarioId,
      pares: saved.pares,
      estado: saved.estado,
      montoPagado: Number(saved.montoPagado),
    };
  }

  @Patch(':id/registro/:regId')
  async updateRegistro(
    @Param('id') valeId: string,
    @Param('regId') regId: string,
    @Body() dto: UpdateProduccionEstadoDto,
    @Req() req: Request & { user: UsuarioAutenticado },
  ) {
    if (dto.estado === EstadoProduccion.APROBADO) {
      throw new BadRequestException(
        'Use el endpoint de revisión para aprobar producción',
      );
    }
    const username = req.user?.username ?? undefined;
    await this.produccionService.updateEstado(
      valeId,
      regId,
      dto.estado,
      undefined,
      username,
    );
    return { success: true };
  }

  @Post(':id/registro/:regId/revision')
  async revisarRegistro(
    @Param('id') valeId: string,
    @Param('regId') regId: string,
    @Body() dto: RevisarProduccionDto,
    @Req() req: Request & { user: UsuarioAutenticado },
  ): Promise<ResultadoRevision> {
    const username = req.user?.username || null;
    return this.produccionService.revisar(valeId, regId, dto, username);
  }

  @Delete(':id/registro/:regId')
  async deleteRegistro(
    @Param('id') valeId: string,
    @Param('regId') regId: string,
    @Req() req: Request & { user: UsuarioAutenticado },
  ) {
    const username = req.user?.username ?? undefined;
    await this.produccionService.deleteRegistro(valeId, regId, username);
    return { success: true };
  }

  private mapToFrontend(v: ValeRaw) {
    const tallasObj: Record<string, number> = {};
    if (v.tallas && Array.isArray(v.tallas)) {
      v.tallas.forEach((t) => {
        tallasObj[t.talla.toString()] = t.cantidad;
      });
    }

    const produccion: Record<string, ProduccionRegRaw[]> = {
      Cortador: [],
      Guarnecedor: [],
      Solador: [],
      Finizaje: [],
    };

    if (v.produccion && Array.isArray(v.produccion)) {
      v.produccion.forEach((r) => {
        if (produccion[r.etapa]) {
          produccion[r.etapa].push({
            id: r.id,
            operarioId: r.operarioId,
            pares: r.pares,
            estado: r.estado,
            montoPagado: Number(r.montoPagado),
            revisadoPor: r.revisadoPor,
            revisadoEn: r.revisadoEn,
            etapa: r.etapa,
          });
        }
      });
    }

    const rechazos: Record<string, RechazoRaw[]> = {
      Cortador: [],
      Guarnecedor: [],
      Solador: [],
      Finizaje: [],
    };

    if (v.rechazos && Array.isArray(v.rechazos)) {
      v.rechazos.forEach((r) => {
        if (rechazos[r.etapa]) {
          rechazos[r.etapa].push({
            pares: r.pares,
            motivo: r.motivo,
            fecha: r.fecha,
            operarioId: r.operarioId,
            etapa: r.etapa,
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
      rechazos,
    };
  }
}

// ── tipos locales para tipado interno del mapper ─────────────────────────────

interface TallaRaw {
  talla: number;
  cantidad: number;
}

interface ProduccionRegRaw {
  id: string;
  operarioId: string;
  pares: number;
  estado: string;
  montoPagado: number | string | null;
  revisadoPor: string | null;
  revisadoEn: Date | string | null;
  etapa: string;
}

interface RechazoRaw {
  pares: number;
  motivo: string;
  fecha: string;
  operarioId: string;
  etapa: string;
}

interface ValeRaw {
  id: string;
  fecha: string;
  almacen: string;
  referenciaId: string;
  color: string;
  altura: string;
  tallas: TallaRaw[];
  produccion: ProduccionRegRaw[];
  rechazos: RechazoRaw[];
}

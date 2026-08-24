import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { EstadoDocumento } from '../../common/enums/estado-documento.enum';
import { AdministrativosService } from '../administrativos/administrativos.service';
import { VentasRepository } from './ventas.repository';
import { ValesService } from '../vales/vales.service';
import { CreateVentaDto } from './dto/create-venta.dto';
import { UpdateVentaDto } from './dto/update-venta.dto';
import { Venta } from './entities/venta.entity';
import { hoyLocal } from '../../common/utils/fecha.util';

@Injectable()
export class VentasService {
  constructor(
    private readonly repository: VentasRepository,
    private readonly valesService: ValesService,
    private readonly administrativosService: AdministrativosService,
  ) {}

  async findAll(): Promise<Venta[]> {
    return this.repository.findAllWithRelations();
  }

  async findAllPaginated(opts: {
    page: number;
    limit: number;
    desde?: string;
    hasta?: string;
  }): Promise<{ data: Venta[]; total: number }> {
    const [data, total] = await this.repository.findPaginated({
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
      desde: opts.desde,
      hasta: opts.hasta,
    });
    return { data, total };
  }

  async findOne(id: string): Promise<Venta> {
    const venta = await this.repository.findByIdWithRelations(id);
    if (!venta) {
      throw new NotFoundException(`Venta con ID ${id} no encontrada`);
    }
    return venta;
  }

  async create(dto: CreateVentaDto): Promise<Venta> {
    // 1. Validar que el vale exista y esté vigente: no se vende producción de un
    // vale que la administración dio de baja.
    this.valesService.assertVigente(
      await this.valesService.findOne(dto.valeId),
    );

    // 2. Establecer fecha por defecto si no viene
    const fecha = dto.fecha || hoyLocal();

    // 3. Crear y guardar (el ID lo genera la secuencia ventas_seq)
    const saved = await this.repository.createAndSave({
      valeId: dto.valeId,
      pares: dto.pares,
      precioUnitario: dto.precioUnitario,
      fecha,
    });

    // 4. Retornar la venta completa con sus relaciones cargadas
    return this.findOne(saved.id);
  }

  async update(id: string, dto: UpdateVentaDto): Promise<Venta> {
    // 1. Validar que la venta exista
    const venta = await this.findOne(id);

    // 2. Validar que el vale exista y esté vigente si se está reasignando
    if (dto.valeId) {
      this.valesService.assertVigente(
        await this.valesService.findOne(dto.valeId),
      );
    }

    // 3. Actualizar campos
    if (dto.valeId !== undefined) venta.valeId = dto.valeId;
    if (dto.pares !== undefined) venta.pares = dto.pares;
    if (dto.precioUnitario !== undefined)
      venta.precioUnitario = dto.precioUnitario;
    if (dto.fecha !== undefined) venta.fecha = dto.fecha;

    await this.repository.save(venta);
    return this.findOne(id);
  }

  /**
   * Anula una venta. Reemplaza al borrado, que se quitó a propósito.
   *
   * El stock vuelve igual que antes —el conteo de vendidos ignora las
   * anuladas—, pero ahora queda escrito quién deshizo la salida y por qué.
   */
  async anular(
    id: string,
    motivo: string,
    anuladoPorId: string,
  ): Promise<Venta> {
    const venta = await this.findOne(id);

    if (venta.estado === EstadoDocumento.ANULADO) {
      throw new BadRequestException(`La venta ${id} ya está anulada.`);
    }

    // Un renglón de una remisión no se anula solo: ese papel ya lo firmó el
    // cliente, y agujerearlo por dentro dejaría un documento entregado que no
    // coincide con lo que dice el sistema. Se anula la remisión completa.
    if (venta.remisionId) {
      throw new BadRequestException(
        `La venta ${id} pertenece a la remisión ${venta.remisionId}: ` +
          'anula la remisión completa.',
      );
    }

    await this.administrativosService.assertSeleccionable(anuladoPorId);

    venta.estado = EstadoDocumento.ANULADO;
    venta.motivoAnulacion = motivo.trim();
    venta.anuladoPorId = anuladoPorId;
    venta.anuladoEn = new Date();
    await this.repository.save(venta);

    return this.findOne(id);
  }
}

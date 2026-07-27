import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ValesRepository } from './vales.repository';
import { ReferenciasService } from '../referencias/referencias.service';
import { AdministrativosService } from '../administrativos/administrativos.service';
import { aPngParaPdf } from '../../common/utils/imagen-pdf.util';
import { Vale } from './entities/vale.entity';

export interface CreateValeServiceDto {
  fecha: string;
  almacen: string;
  color: string;
  altura?: string | null;
  referenciaId: string;
  creadoPorId?: string | null;
  tallas: { talla: number; cantidad: number }[];
}

@Injectable()
export class ValesService {
  private readonly logger = new Logger(ValesService.name);

  constructor(
    private readonly repository: ValesRepository,
    private readonly referenciasService: ReferenciasService,
    private readonly administrativosService: AdministrativosService,
  ) {}

  async findAll(): Promise<Vale[]> {
    return this.repository.findAllWithRelations();
  }

  async findAllPaginated(opts: {
    page: number;
    limit: number;
    desde?: string;
    hasta?: string;
  }): Promise<{ data: Vale[]; total: number }> {
    const [data, total] = await this.repository.findPaginated({
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
      desde: opts.desde,
      hasta: opts.hasta,
    });
    return { data, total };
  }

  async findOne(id: string): Promise<Vale> {
    const vale = await this.repository.findByIdWithRelations(id);
    if (!vale) {
      throw new NotFoundException(`Vale con ID ${id} no encontrado`);
    }
    return vale;
  }

  /**
   * Foto del modelo, ya normalizada a PNG chico para el PDF del vale. Nunca
   * falla: si la referencia no tiene imagen o no se puede convertir, el vale se
   * imprime igual con el marcador «sin foto».
   */
  async fotoDelModelo(referenciaId: string): Promise<Buffer | undefined> {
    let datos: Buffer;
    try {
      ({ datos } = await this.referenciasService.getImagen(referenciaId));
    } catch {
      this.logger.log(
        `La referencia ${referenciaId} no tiene imagen; el vale sale sin foto.`,
      );
      return undefined;
    }
    return aPngParaPdf(datos);
  }

  async create(dto: CreateValeServiceDto): Promise<Vale> {
    // 1. Validar que la referencia exista usando el ReferenciasService
    await this.referenciasService.findOne(dto.referenciaId);

    // 2. Si viene responsable, tiene que existir y estar activo. Un vale no se
    // firma a nombre de alguien que ya no está.
    if (dto.creadoPorId) {
      await this.administrativosService.assertSeleccionable(dto.creadoPorId);
    }

    // 3. Delegar la creación transaccional al repositorio (el ID lo genera la secuencia vales_seq)
    return this.repository.crearConRelaciones(
      {
        fecha: dto.fecha,
        almacen: dto.almacen,
        color: dto.color,
        altura: dto.altura,
        referenciaId: dto.referenciaId,
        creadoPorId: dto.creadoPorId ?? null,
      },
      dto.tallas,
    );
  }

  /**
   * Reasigna el responsable de un vale ya creado — es el selector de la ficha
   * del vale, que puede completarse después del alta.
   */
  async asignarResponsable(id: string, creadoPorId: string): Promise<Vale> {
    await this.findOne(id);
    await this.administrativosService.assertSeleccionable(creadoPorId);
    await this.repository.update(id, { creadoPorId });
    return this.findOne(id);
  }
}

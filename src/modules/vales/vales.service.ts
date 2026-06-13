import { Injectable, NotFoundException } from '@nestjs/common';
import { ValesRepository } from './vales.repository';
import { ReferenciasService } from '../referencias/referencias.service';
import { Vale } from './entities/vale.entity';

export interface CreateValeServiceDto {
  fecha: string;
  almacen: string;
  color: string;
  altura?: string | null;
  referenciaId: string;
  tallas: { talla: number; cantidad: number }[];
}

@Injectable()
export class ValesService {
  constructor(
    private readonly repository: ValesRepository,
    private readonly referenciasService: ReferenciasService,
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

  async create(dto: CreateValeServiceDto): Promise<Vale> {
    // 1. Validar que la referencia exista usando el ReferenciasService
    await this.referenciasService.findOne(dto.referenciaId);

    // 2. Delegar la creación transaccional al repositorio (el ID lo genera la secuencia vales_seq)
    return this.repository.crearConRelaciones(
      {
        fecha: dto.fecha,
        almacen: dto.almacen,
        color: dto.color,
        altura: dto.altura,
        referenciaId: dto.referenciaId,
      },
      dto.tallas,
    );
  }
}

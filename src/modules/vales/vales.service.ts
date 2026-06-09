import { Injectable, NotFoundException } from '@nestjs/common';
import { ValesRepository } from './vales.repository';
import { ReferenciasService } from '../referencias/referencias.service';
import { Vale } from './entities/vale.entity';

export interface CreateValeServiceDto {
  fecha: string;
  almacen: string;
  color: string;
  altura: string;
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

    // 2. Generar el ID secuencial V-XXXX (4 dígitos)
    const last = await this.repository.findLast();
    let nextNum = 1;
    if (last) {
      const parts = last.id.split('-');
      if (parts.length > 1) {
        nextNum = parseInt(parts[1], 10) + 1;
      }
    }
    const nextId = 'V-' + String(nextNum).padStart(4, '0');

    // 3. Delegar la creación transaccional al repositorio
    return this.repository.crearConRelaciones(
      {
        id: nextId,
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

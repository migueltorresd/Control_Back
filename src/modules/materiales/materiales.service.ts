import { Injectable, NotFoundException } from '@nestjs/common';
import {
  FiltrosMaterial,
  FiltrosMaterialPaginados,
  MaterialesRepository,
} from './materiales.repository';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { Material } from './entities/material.entity';

@Injectable()
export class MaterialesService {
  constructor(private readonly repository: MaterialesRepository) {}

  async findAll(filtros: FiltrosMaterial = {}): Promise<Material[]> {
    return this.repository.findAllOrderedById(filtros);
  }

  async findAllPaginated(
    filtros: FiltrosMaterialPaginados,
  ): Promise<{ data: Material[]; total: number }> {
    return this.repository.findAllPaginated(filtros);
  }

  async findOne(id: string): Promise<Material> {
    const material = await this.repository.findById(id);
    if (!material) {
      throw new NotFoundException(`Material con ID ${id} no encontrado`);
    }
    return material;
  }

  async create(dto: CreateMaterialDto): Promise<Material> {
    return this.repository.createAndSave({
      id: await this.siguienteId(),
      nombre: dto.nombre,
      proveedor: dto.proveedor,
      unidad: dto.unidad,
      tipo: dto.tipo ?? null,
      precio: dto.precio,
    });
  }

  async update(id: string, dto: UpdateMaterialDto): Promise<Material> {
    // Validar primero si existe antes de actualizar
    await this.findOne(id);

    const updated = await this.repository.updateMaterial(id, dto);
    if (!updated) {
      throw new NotFoundException(
        `Material con ID ${id} no se pudo actualizar`,
      );
    }
    return updated;
  }

  /**
   * Siguiente ID de la serie `MT-NN`.
   *
   * Toma el máximo del sufijo numérico en vez del último id por orden
   * alfabético: como texto, `'MT-99'` es mayor que `'MT-100'`, así que ordenar
   * por id repetiría el 100 y reventaría contra la llave primaria en cuanto el
   * catálogo pase de 99 materiales. Los ids ya emitidos no cambian.
   */
  private async siguienteId(): Promise<string> {
    const existentes = await this.repository.find({ select: { id: true } });
    const ultimo = existentes.reduce((max, { id }) => {
      const num = parseInt(id.split('-')[1], 10);
      return Number.isNaN(num) ? max : Math.max(max, num);
    }, 0);

    return 'MT-' + String(ultimo + 1).padStart(2, '0');
  }
}

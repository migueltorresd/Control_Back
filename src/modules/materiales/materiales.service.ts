import { Injectable, NotFoundException } from '@nestjs/common';
import { MaterialesRepository } from './materiales.repository';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { Material } from './entities/material.entity';

@Injectable()
export class MaterialesService {
  constructor(private readonly repository: MaterialesRepository) {}

  async findAll(): Promise<Material[]> {
    return this.repository.findAllOrderedById();
  }

  async findOne(id: string): Promise<Material> {
    const material = await this.repository.findById(id);
    if (!material) {
      throw new NotFoundException(`Material con ID ${id} no encontrado`);
    }
    return material;
  }

  async create(dto: CreateMaterialDto): Promise<Material> {
    const last = await this.repository.findLast();
    const lastNum = last ? parseInt(last.id.split('-')[1], 10) : 0;
    const nextId = 'MT-' + String(lastNum + 1).padStart(2, '0');

    return this.repository.createAndSave({
      id: nextId,
      nombre: dto.nombre,
      proveedor: dto.proveedor,
      unidad: dto.unidad,
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
}

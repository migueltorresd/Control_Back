import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Material } from './entities/material.entity';

@Injectable()
export class MaterialesRepository extends Repository<Material> {
  constructor(private dataSource: DataSource) {
    super(Material, dataSource.createEntityManager());
  }

  async findAllOrderedById(): Promise<Material[]> {
    return this.find({ order: { id: 'ASC' } });
  }

  async findById(id: string): Promise<Material | null> {
    return this.findOneBy({ id });
  }

  async findLast(): Promise<Material | null> {
    return this.findOne({ where: {}, order: { id: 'DESC' } });
  }

  async createAndSave(materialData: { id: string; nombre: string; proveedor?: string; unidad: string; precio: number }): Promise<Material> {
    const newMaterial = this.create(materialData);
    return this.save(newMaterial);
  }

  async updateMaterial(id: string, materialData: Partial<Material>): Promise<Material | null> {
    await this.update(id, materialData);
    return this.findById(id);
  }
}

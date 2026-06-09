import { Controller, Get, Post, Body } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Material } from '../entities/material.entity';

@Controller('materiales')
export class MaterialesController {
  constructor(
    @InjectRepository(Material)
    private readonly repo: Repository<Material>,
  ) {}

  @Get()
  async findAll() {
    return this.repo.find({ order: { id: 'ASC' } });
  }

  @Post()
  async save(@Body() body: any) {
    if (body.id) {
      await this.repo.update(body.id, body);
      return this.repo.findOneBy({ id: body.id });
    }
    const count = await this.repo.count();
    const nextId = 'MT-' + String(count + 1).padStart(2, '0');
    const newMaterial = this.repo.create({ ...body, id: nextId });
    return this.repo.save(newMaterial);
  }
}

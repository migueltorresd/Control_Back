import { Controller, Get, Post, Body } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Referencia } from '../entities/referencia.entity';

@Controller('referencias')
export class ReferenciasController {
  constructor(
    @InjectRepository(Referencia)
    private readonly repo: Repository<Referencia>,
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
    const nextId = 'REF-' + String(count + 1).padStart(3, '0');
    const newReferencia = this.repo.create({ ...body, id: nextId });
    return this.repo.save(newReferencia);
  }
}

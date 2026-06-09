import { Controller, Get, Post, Body } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Operario } from '../entities/operario.entity';

@Controller('operarios')
export class OperariosController {
  constructor(
    @InjectRepository(Operario)
    private readonly repo: Repository<Operario>,
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
    const nextId = 'OP-' + String(count + 1).padStart(2, '0');
    const newOperario = this.repo.create({ ...body, id: nextId });
    return this.repo.save(newOperario);
  }
}

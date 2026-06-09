import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Operario } from './entities/operario.entity';

@Injectable()
export class OperariosRepository extends Repository<Operario> {
  constructor(private dataSource: DataSource) {
    super(Operario, dataSource.createEntityManager());
  }

  async findAllOrderedById(): Promise<Operario[]> {
    return this.find({ order: { id: 'ASC' } });
  }

  async findById(id: string): Promise<Operario | null> {
    return this.findOneBy({ id });
  }

  async findLast(): Promise<Operario | null> {
    return this.findOne({ where: {}, order: { id: 'DESC' } });
  }

  async createAndSave(operarioData: { id: string; nombre: string; oficio: any; antiguedad?: number }): Promise<Operario> {
    const newOperario = this.create(operarioData);
    return this.save(newOperario);
  }

  async updateOperario(id: string, operarioData: Partial<Operario>): Promise<Operario | null> {
    await this.update(id, operarioData);
    return this.findById(id);
  }
}

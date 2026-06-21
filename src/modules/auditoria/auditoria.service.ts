import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Auditoria } from './entities/auditoria.entity';

@Injectable()
export class AuditoriaService {
  constructor(
    @InjectRepository(Auditoria)
    private readonly repository: Repository<Auditoria>,
  ) {}

  async registrar(
    entry: Partial<Auditoria>,
    manager: EntityManager,
  ): Promise<Auditoria> {
    const audit = manager.create(Auditoria, entry);
    return manager.save(Auditoria, audit);
  }

  async find(query: {
    page?: number;
    limit?: number;
    entidadId?: string;
  }): Promise<{
    data: Auditoria[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const queryBuilder = this.repository
      .createQueryBuilder('auditoria')
      .orderBy('auditoria.fecha', 'DESC')
      .skip(skip)
      .take(limit);

    if (query.entidadId) {
      queryBuilder.andWhere('auditoria.entidadId = :entidadId', {
        entidadId: query.entidadId,
      });
    }

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}

import { Injectable } from '@nestjs/common';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { Material } from './entities/material.entity';
import { TipoMaterial } from '../../common/enums/tipo-material.enum';
import { SIN_CLASIFICAR } from './dto/materiales-query.dto';

export interface FiltrosMaterial {
  tipo?: TipoMaterial | typeof SIN_CLASIFICAR;
  q?: string;
}

export interface FiltrosMaterialPaginados extends FiltrosMaterial {
  page: number;
  limit: number;
}

@Injectable()
export class MaterialesRepository extends Repository<Material> {
  constructor(private dataSource: DataSource) {
    super(Material, dataSource.createEntityManager());
  }

  async findAllOrderedById(filtros: FiltrosMaterial = {}): Promise<Material[]> {
    return this.construirQuery(filtros).getMany();
  }

  async findAllPaginated(
    filtros: FiltrosMaterialPaginados,
  ): Promise<{ data: Material[]; total: number }> {
    const [data, total] = await this.construirQuery(filtros)
      .skip((filtros.page - 1) * filtros.limit)
      .take(filtros.limit)
      .getManyAndCount();

    return { data, total };
  }

  async findById(id: string): Promise<Material | null> {
    return this.findOneBy({ id });
  }

  async findLast(): Promise<Material | null> {
    return this.findOne({ where: {}, order: { id: 'DESC' } });
  }

  async createAndSave(materialData: {
    id: string;
    nombre: string;
    proveedor?: string;
    unidad: string;
    tipo?: TipoMaterial | null;
    precio: number;
  }): Promise<Material> {
    const newMaterial = this.create(materialData);
    return this.save(newMaterial);
  }

  async updateMaterial(
    id: string,
    materialData: Partial<Material>,
  ): Promise<Material | null> {
    await this.update(id, materialData);
    return this.findById(id);
  }

  private construirQuery(
    filtros: FiltrosMaterial,
  ): SelectQueryBuilder<Material> {
    const qb = this.createQueryBuilder('material').orderBy(
      'material.id',
      'ASC',
    );

    if (filtros.tipo === SIN_CLASIFICAR) {
      qb.andWhere('material.tipo IS NULL');
    } else if (filtros.tipo) {
      qb.andWhere('material.tipo = :tipo', { tipo: filtros.tipo });
    }

    const termino = filtros.q?.trim();
    if (termino) {
      // Los comodines de LIKE se escapan: si alguien busca "50%", queremos
      // materiales que digan "50%", no cualquier cosa que empiece con "50".
      const patron = `%${termino.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      qb.andWhere(
        `(material.nombre ILIKE :patron OR COALESCE(material.proveedor, '') ILIKE :patron)`,
        { patron },
      );
    }

    return qb;
  }
}

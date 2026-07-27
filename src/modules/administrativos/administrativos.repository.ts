import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Administrativo } from './entities/administrativo.entity';

@Injectable()
export class AdministrativosRepository extends Repository<Administrativo> {
  constructor(private dataSource: DataSource) {
    super(Administrativo, dataSource.createEntityManager());
  }

  async findAllOrderedById(): Promise<Administrativo[]> {
    return this.find({ order: { id: 'ASC' } });
  }

  /** Solo los que pueden seleccionarse hoy en el selector de un vale. */
  async findActivos(): Promise<Administrativo[]> {
    return this.find({ where: { activo: true }, order: { nombre: 'ASC' } });
  }

  async findById(id: string): Promise<Administrativo | null> {
    return this.findOneBy({ id });
  }

  async findByCorreo(correo: string): Promise<Administrativo | null> {
    return this.findOneBy({ correo });
  }

  async findLast(): Promise<Administrativo | null> {
    return this.findOne({ where: {}, order: { id: 'DESC' } });
  }

  async createAndSave(data: {
    id: string;
    nombre: string;
    correo: string;
    cargo?: string | null;
    antiguedad?: number | null;
    activo?: boolean;
  }): Promise<Administrativo> {
    const nuevo = this.create(data);
    return this.save(nuevo);
  }

  async updateAdministrativo(
    id: string,
    data: Partial<Administrativo>,
  ): Promise<Administrativo | null> {
    await this.update(id, data);
    return this.findById(id);
  }
}

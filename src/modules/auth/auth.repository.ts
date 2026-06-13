import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Usuario } from './entities/usuario.entity';

@Injectable()
export class AuthRepository extends Repository<Usuario> {
  constructor(private dataSource: DataSource) {
    super(Usuario, dataSource.createEntityManager());
  }

  async findActiveByUsername(username: string): Promise<Usuario | null> {
    return this.findOne({ where: { username, activo: true } });
  }

  async findActiveById(id: string): Promise<Usuario | null> {
    return this.findOne({ where: { id, activo: true } });
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.update({ id }, { passwordHash });
  }
}

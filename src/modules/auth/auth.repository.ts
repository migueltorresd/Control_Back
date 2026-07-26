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

  /**
   * Cambia la contraseña e incrementa la versión de sesión en la misma
   * operación: todos los tokens emitidos antes quedan revocados.
   */
  async updatePasswordAndRevoke(
    id: string,
    passwordHash: string,
  ): Promise<void> {
    await this.update(
      { id },
      {
        passwordHash,
        tokenVersion: () => '"tokenVersion" + 1',
      },
    );
  }
}

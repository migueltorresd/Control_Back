import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy, JwtPayload } from './jwt.strategy';
import { AuthRepository } from './auth.repository';
import { Rol } from './enums/rol.enum';

describe('JwtStrategy (revocación de sesiones)', () => {
  let strategy: JwtStrategy;

  const repository = { findActiveById: jest.fn() };
  const config = {
    get: jest.fn().mockReturnValue('secreto_de_pruebas_32_chars_ok!!'),
  };

  const payload: JwtPayload = {
    sub: 'uuid-1',
    username: 'admin',
    rol: Rol.ADMIN,
    operarioId: null,
    tokenVersion: 2,
  };

  const usuarioDb = {
    id: 'uuid-1',
    username: 'admin',
    rol: Rol.ADMIN,
    operarioId: null,
    activo: true,
    tokenVersion: 2,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: ConfigService, useValue: config },
        { provide: AuthRepository, useValue: repository },
      ],
    }).compile();
    strategy = module.get(JwtStrategy);
  });

  it('token vigente (versión coincide) → devuelve el usuario autenticado', async () => {
    repository.findActiveById.mockResolvedValue(usuarioDb);

    const result = await strategy.validate(payload);

    expect(result).toEqual({
      userId: 'uuid-1',
      username: 'admin',
      rol: Rol.ADMIN,
      operarioId: null,
    });
  });

  it('token revocado (versión distinta en BD) → 401', async () => {
    repository.findActiveById.mockResolvedValue({
      ...usuarioDb,
      tokenVersion: 3,
    });

    await expect(strategy.validate(payload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('usuario desactivado o inexistente → 401', async () => {
    repository.findActiveById.mockResolvedValue(null);

    await expect(strategy.validate(payload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('token viejo sin tokenVersion en el payload → 401 (no se acepta legacy)', async () => {
    repository.findActiveById.mockResolvedValue(usuarioDb);
    const legacy = { ...payload } as Partial<JwtPayload>;
    delete legacy.tokenVersion;

    await expect(strategy.validate(legacy as JwtPayload)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});

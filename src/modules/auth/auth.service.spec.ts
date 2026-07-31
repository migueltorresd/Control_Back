import { Test } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { Rol } from './enums/rol.enum';

describe('AuthService', () => {
  let service: AuthService;

  const repository = {
    findActiveByUsername: jest.fn(),
    findActiveById: jest.fn(),
    updatePasswordAndRevoke: jest.fn(),
  };
  const jwtService = { signAsync: jest.fn() };

  const usuarioBase = async () => ({
    id: 'uuid-1',
    username: 'admin',
    passwordHash: await bcrypt.hash('ClaveActual123', 4),
    rol: Rol.ADMIN,
    operarioId: null,
    activo: true,
    tokenVersion: 3,
    debeCambiarPassword: false,
    passwordTemporalExpiraEn: null as Date | null,
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: repository },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  it('login feliz: el JWT incluye la tokenVersion vigente del usuario', async () => {
    repository.findActiveByUsername.mockResolvedValue(await usuarioBase());
    jwtService.signAsync.mockResolvedValue('jwt-firmado');

    const result = await service.login('admin', 'ClaveActual123', '1.2.3.4');

    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'uuid-1', tokenVersion: 3 }),
    );
    expect(result.accessToken).toBe('jwt-firmado');
  });

  it('login con contraseña incorrecta → 401 sin emitir token', async () => {
    repository.findActiveByUsername.mockResolvedValue(await usuarioBase());

    await expect(
      service.login('admin', 'ClaveMala', '1.2.3.4'),
    ).rejects.toThrow(UnauthorizedException);
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it('changePassword feliz: actualiza el hash Y revoca las sesiones', async () => {
    repository.findActiveById.mockResolvedValue(await usuarioBase());

    await service.changePassword('uuid-1', 'ClaveActual123', 'ClaveNueva4567');

    expect(repository.updatePasswordAndRevoke).toHaveBeenCalledWith(
      'uuid-1',
      expect.any(String),
    );
  });

  it('changePassword con actual incorrecta → 400 y NO revoca nada', async () => {
    repository.findActiveById.mockResolvedValue(await usuarioBase());

    await expect(
      service.changePassword('uuid-1', 'ClaveMala', 'ClaveNueva4567'),
    ).rejects.toThrow(BadRequestException);
    expect(repository.updatePasswordAndRevoke).not.toHaveBeenCalled();
  });

  it('login con contraseña temporal vencida → 401 sin emitir token', async () => {
    repository.findActiveByUsername.mockResolvedValue({
      ...(await usuarioBase()),
      debeCambiarPassword: true,
      passwordTemporalExpiraEn: new Date(Date.now() - 60_000),
    });

    await expect(
      service.login('admin', 'ClaveActual123', '1.2.3.4'),
    ).rejects.toThrow(UnauthorizedException);
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it('login con temporal vigente sí entra, y avisa que debe cambiarla', async () => {
    repository.findActiveByUsername.mockResolvedValue({
      ...(await usuarioBase()),
      debeCambiarPassword: true,
      passwordTemporalExpiraEn: new Date(Date.now() + 3600_000),
    });
    jwtService.signAsync.mockResolvedValue('jwt-firmado');

    const result = await service.login('admin', 'ClaveActual123', '1.2.3.4');

    expect(result.usuario.debeCambiarPassword).toBe(true);
  });

  it('rechaza contraseñas de menos de 12 caracteres (ASVS 2.1.1)', () => {
    expect(() =>
      AuthService.validarPoliticaPassword('Corta12345', 'admin'),
    ).toThrow(BadRequestException);
    expect(() =>
      AuthService.validarPoliticaPassword('DoceExactos1', 'admin'),
    ).not.toThrow();
  });

  it('rechaza una contraseña igual al nombre de usuario', () => {
    expect(() =>
      AuthService.validarPoliticaPassword('administrador', 'administrador'),
    ).toThrow(BadRequestException);
  });
});

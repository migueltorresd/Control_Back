import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PasswordChangeRequiredGuard } from './password-change-required.guard';
import { Rol } from '../enums/rol.enum';

describe('PasswordChangeRequiredGuard', () => {
  let guard: PasswordChangeRequiredGuard;
  let reflector: Reflector;

  const contexto = (req: Record<string, unknown>): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => undefined,
      getClass: () => undefined,
    }) as unknown as ExecutionContext;

  const usuario = (debeCambiarPassword: boolean) => ({
    userId: 'uuid-1',
    username: 'juan',
    rol: Rol.ADMIN,
    operarioId: null,
    debeCambiarPassword,
  });

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PasswordChangeRequiredGuard(reflector);
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
  });

  it('deja pasar a quien no tiene contraseña temporal', () => {
    const ctx = contexto({
      user: usuario(false),
      method: 'GET',
      path: '/api/v1/vales',
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('bloquea el resto del sistema con contraseña temporal vigente', () => {
    const ctx = contexto({
      user: usuario(true),
      method: 'GET',
      path: '/api/v1/vales',
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('bloquea también las escrituras, no solo las lecturas', () => {
    const ctx = contexto({
      user: usuario(true),
      method: 'POST',
      path: '/api/v1/pagos/lote',
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('permite la única salida: cambiar la propia contraseña', () => {
    const ctx = contexto({
      user: usuario(true),
      method: 'PATCH',
      path: '/api/v1/auth/password',
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('no interfiere con las rutas públicas (login)', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const ctx = contexto({ method: 'POST', path: '/api/v1/auth/login' });
    expect(guard.canActivate(ctx)).toBe(true);
  });
});

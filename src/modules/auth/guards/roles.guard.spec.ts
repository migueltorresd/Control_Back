import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { Rol, alcanzaRol, superaA } from '../enums/rol.enum';

describe('jerarquía de roles', () => {
  it('SUPER_ADMIN alcanza todos los niveles', () => {
    expect(alcanzaRol(Rol.SUPER_ADMIN, Rol.SUPER_ADMIN)).toBe(true);
    expect(alcanzaRol(Rol.SUPER_ADMIN, Rol.ADMIN)).toBe(true);
    expect(alcanzaRol(Rol.SUPER_ADMIN, Rol.OPERARIO)).toBe(true);
  });

  it('ADMIN no llega a SUPER_ADMIN', () => {
    expect(alcanzaRol(Rol.ADMIN, Rol.SUPER_ADMIN)).toBe(false);
    expect(alcanzaRol(Rol.ADMIN, Rol.ADMIN)).toBe(true);
  });

  it('OPERARIO solo alcanza su propio nivel', () => {
    expect(alcanzaRol(Rol.OPERARIO, Rol.ADMIN)).toBe(false);
    expect(alcanzaRol(Rol.OPERARIO, Rol.OPERARIO)).toBe(true);
  });

  it('superaA es estricto: nadie se supera a sí mismo', () => {
    expect(superaA(Rol.ADMIN, Rol.ADMIN)).toBe(false);
    expect(superaA(Rol.SUPER_ADMIN, Rol.ADMIN)).toBe(true);
    expect(superaA(Rol.ADMIN, Rol.SUPER_ADMIN)).toBe(false);
  });
});

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  const contexto = (rol?: Rol): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => (rol ? { user: { rol } } : {}),
      }),
      getHandler: () => undefined,
      getClass: () => undefined,
    }) as unknown as ExecutionContext;

  /** Simula @Public() y @Roles() sobre el handler. */
  const metadata = (isPublic: boolean, roles?: Rol[]) => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementation((key: unknown) =>
        key === 'isPublic' ? isPublic : roles,
      );
  };

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('las rutas públicas no piden rol', () => {
    metadata(true);
    expect(guard.canActivate(contexto())).toBe(true);
  });

  // El bug que evita este test: con `includes` exacto, el rol MÁS ALTO del
  // sistema quedaba sin acceso a los 9 controladores marcados @Roles(ADMIN).
  it('SUPER_ADMIN entra donde se exige ADMIN', () => {
    metadata(false, [Rol.ADMIN]);
    expect(guard.canActivate(contexto(Rol.SUPER_ADMIN))).toBe(true);
  });

  it('ADMIN entra donde se exige ADMIN', () => {
    metadata(false, [Rol.ADMIN]);
    expect(guard.canActivate(contexto(Rol.ADMIN))).toBe(true);
  });

  it('OPERARIO NO entra donde se exige ADMIN', () => {
    metadata(false, [Rol.ADMIN]);
    expect(guard.canActivate(contexto(Rol.OPERARIO))).toBe(false);
  });

  it('ADMIN NO entra donde se exige SUPER_ADMIN', () => {
    metadata(false, [Rol.SUPER_ADMIN]);
    expect(guard.canActivate(contexto(Rol.ADMIN))).toBe(false);
  });

  it('sin usuario autenticado no pasa', () => {
    metadata(false, [Rol.ADMIN]);
    expect(guard.canActivate(contexto())).toBe(false);
  });

  it('sin @Roles alcanza con estar autenticado', () => {
    metadata(false, undefined);
    expect(guard.canActivate(contexto(Rol.OPERARIO))).toBe(true);
  });
});

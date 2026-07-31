import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { UsuarioAutenticado } from '../jwt.strategy';

/**
 * Mientras el usuario tenga una contraseña puesta por un administrador, lo
 * único que puede hacer es cambiarla.
 *
 * Sin este guard, "contraseña temporal" sería apenas una sugerencia: quien la
 * recibe puede seguir trabajando para siempre con una clave que otra persona
 * conoce, y todo lo que haga queda auditado a su nombre. El aviso en pantalla
 * no es un control; esto sí.
 */
@Injectable()
export class PasswordChangeRequiredGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: UsuarioAutenticado }>();
    const user = request.user;

    if (!user?.debeCambiarPassword) return true;

    // La única salida: el endpoint que cambia la propia contraseña.
    const esCambioDePassword =
      request.method === 'PATCH' && request.path.endsWith('/auth/password');
    if (esCambioDePassword) return true;

    throw new ForbiddenException(
      'Tenés que cambiar tu contraseña temporal antes de usar el sistema.',
    );
  }
}

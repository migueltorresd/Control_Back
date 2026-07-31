import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthRepository } from './auth.repository';
import { Rol } from './enums/rol.enum';

export interface JwtPayload {
  sub: string;
  username: string;
  rol: Rol;
  operarioId: string | null;
  tokenVersion: number;
}

/** Lo que queda disponible en request.user tras validar el token. */
export interface UsuarioAutenticado {
  userId: string;
  username: string;
  rol: Rol;
  operarioId: string | null;
  /** Contraseña puesta por un administrador: solo puede cambiarla. */
  debeCambiarPassword: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly repository: AuthRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') as string,
    });
  }

  /**
   * Además de la firma y expiración (que valida passport-jwt), se verifica el
   * usuario contra la BD en cada request: si fue desactivado o su
   * tokenVersion cambió (p. ej. por cambio de contraseña), el token muere al
   * instante aunque no haya expirado. Un JWT robado deja de servir en cuanto
   * el dueño cambia su contraseña.
   */
  async validate(payload: JwtPayload): Promise<UsuarioAutenticado> {
    const usuario = await this.repository.findActiveById(payload.sub);
    if (!usuario || usuario.tokenVersion !== (payload.tokenVersion ?? -1)) {
      throw new UnauthorizedException('Sesión inválida o revocada');
    }

    // Una contraseña temporal vencida no sirve ni para seguir la sesión ya
    // abierta: si no la cambió a tiempo, hay que pedir un reset nuevo.
    if (
      usuario.passwordTemporalExpiraEn &&
      usuario.passwordTemporalExpiraEn.getTime() < Date.now()
    ) {
      throw new UnauthorizedException(
        'La contraseña temporal venció. Pedí un nuevo restablecimiento.',
      );
    }

    // Los datos frescos de la BD mandan (p. ej. un cambio de rol aplica ya)
    return {
      userId: usuario.id,
      username: usuario.username,
      rol: usuario.rol,
      operarioId: usuario.operarioId,
      debeCambiarPassword: usuario.debeCambiarPassword,
    };
  }
}

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Rol } from './enums/rol.enum';

export interface JwtPayload {
  sub: string;
  username: string;
  rol: Rol;
  operarioId: string | null;
}

/** Lo que queda disponible en request.user tras validar el token. */
export interface UsuarioAutenticado {
  userId: string;
  username: string;
  rol: Rol;
  operarioId: string | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') as string,
    });
  }

  validate(payload: JwtPayload): UsuarioAutenticado {
    return {
      userId: payload.sub,
      username: payload.username,
      rol: payload.rol,
      operarioId: payload.operarioId,
    };
  }
}

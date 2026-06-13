import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthRepository } from './auth.repository';
import { JwtPayload } from './jwt.strategy';
import { Rol } from './enums/rol.enum';

const BCRYPT_ROUNDS = 12;
const PASSWORD_MIN_LENGTH = 10;

export interface LoginResult {
  accessToken: string;
  usuario: { username: string; rol: Rol };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly repository: AuthRepository,
    private readonly jwtService: JwtService,
  ) {}

  async login(
    username: string,
    password: string,
    ip: string,
  ): Promise<LoginResult> {
    const usuario = await this.repository.findActiveByUsername(username);

    // Mismo mensaje exista o no el usuario: no revelar cuál de los dos falló
    const passwordOk =
      usuario && (await bcrypt.compare(password, usuario.passwordHash));
    if (!usuario || !passwordOk) {
      this.logger.warn(`Login fallido para "${username}" desde ${ip}`);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    this.logger.log(`Login exitoso de "${username}" desde ${ip}`);

    const payload: JwtPayload = {
      sub: usuario.id,
      username: usuario.username,
      rol: usuario.rol,
      operarioId: usuario.operarioId,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      usuario: { username: usuario.username, rol: usuario.rol },
    };
  }

  async changePassword(
    userId: string,
    passwordActual: string,
    passwordNueva: string,
  ): Promise<void> {
    const usuario = await this.repository.findActiveById(userId);
    if (!usuario) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const actualOk = await bcrypt.compare(passwordActual, usuario.passwordHash);
    if (!actualOk) {
      this.logger.warn(
        `Cambio de contraseña rechazado para "${usuario.username}": contraseña actual incorrecta`,
      );
      throw new BadRequestException('La contraseña actual no es correcta');
    }

    AuthService.validarPoliticaPassword(passwordNueva, usuario.username);

    const passwordHash = await bcrypt.hash(passwordNueva, BCRYPT_ROUNDS);
    await this.repository.updatePassword(usuario.id, passwordHash);
    this.logger.log(`Contraseña actualizada para "${usuario.username}"`);
  }

  /** Política compartida con el script create-admin. */
  static validarPoliticaPassword(password: string, username: string): void {
    if (!password || password.length < PASSWORD_MIN_LENGTH) {
      throw new BadRequestException(
        `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`,
      );
    }
    if (password.toLowerCase() === username.toLowerCase()) {
      throw new BadRequestException(
        'La contraseña no puede ser igual al nombre de usuario',
      );
    }
  }

  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }
}

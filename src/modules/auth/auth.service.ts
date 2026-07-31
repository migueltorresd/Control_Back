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
import { estaFiltrada } from '../../common/utils/password-breach.util';

const BCRYPT_ROUNDS = 12;
// OWASP ASVS 2.1.1 exige 8 como piso y recomienda 12. Vamos por el recomendado.
const PASSWORD_MIN_LENGTH = 12;

export interface LoginResult {
  accessToken: string;
  usuario: {
    username: string;
    /** Nombre para mostrar; null si la cuenta no lo tiene cargado. */
    nombre: string | null;
    rol: Rol;
    debeCambiarPassword: boolean;
  };
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

    // Una contraseña temporal vencida no abre sesión: hay que pedir un reset
    // nuevo. Se responde igual que unas credenciales inválidas para no
    // confirmarle a un atacante que la cuenta existe y está en ese estado.
    if (
      usuario.passwordTemporalExpiraEn &&
      usuario.passwordTemporalExpiraEn.getTime() < Date.now()
    ) {
      this.logger.warn(
        `Login rechazado para "${username}": la contraseña temporal venció`,
      );
      throw new UnauthorizedException('Credenciales inválidas');
    }

    this.logger.log(`Login exitoso de "${username}" desde ${ip}`);

    const payload: JwtPayload = {
      sub: usuario.id,
      username: usuario.username,
      rol: usuario.rol,
      operarioId: usuario.operarioId,
      tokenVersion: usuario.tokenVersion,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      usuario: {
        username: usuario.username,
        nombre: usuario.nombre,
        rol: usuario.rol,
        debeCambiarPassword: usuario.debeCambiarPassword,
      },
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
    await AuthService.validarPasswordNoFiltrada(passwordNueva);

    const passwordHash = await bcrypt.hash(passwordNueva, BCRYPT_ROUNDS);
    // Revoca todas las sesiones activas (incluida la actual): tras cambiar la
    // contraseña hay que volver a iniciar sesión.
    await this.repository.updatePasswordAndRevoke(usuario.id, passwordHash);
    this.logger.log(
      `Contraseña actualizada y sesiones revocadas para "${usuario.username}"`,
    );
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

  /**
   * Rechaza contraseñas que aparecen en filtraciones conocidas (ASVS 2.1.7).
   * Se salta en tests y donde se desactive explícitamente, para no depender de
   * la red en entornos sin salida a internet.
   */
  static async validarPasswordNoFiltrada(password: string): Promise<void> {
    const desactivado =
      process.env.NODE_ENV === 'test' ||
      process.env.PASSWORD_BREACH_CHECK === 'false';
    if (desactivado) return;

    if (await estaFiltrada(password)) {
      throw new BadRequestException(
        'Esa contraseña aparece en filtraciones públicas conocidas. Elegí otra.',
      );
    }
  }

  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }
}

import { Module, Injectable } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { randomBytes } from 'node:crypto';
import { envValidationSchema } from '../config/env.validation';
import { resolverDbSsl } from '../config/db-ssl';
import { Usuario } from '../modules/auth/entities/usuario.entity';
import { Operario } from '../modules/operarios/entities/operario.entity';
import { Auditoria } from '../modules/auditoria/entities/auditoria.entity';
import { AuthService } from '../modules/auth/auth.service';

/**
 * Restablece la contraseña de un usuario desde la línea de comandos.
 *
 * Es el procedimiento de rescate mientras no exista la gestión de usuarios en
 * la app: sin esto, recuperar una cuenta obliga a escribir un hash de bcrypt a
 * mano y correr SQL crudo contra producción.
 *
 * Al reescribir la contraseña incrementa `tokenVersion`, así que toda sesión
 * abierta con la contraseña vieja muere al instante — incluida la de quien
 * haya robado el token. Ese es el punto: en un robo de credenciales no alcanza
 * con cambiar la clave si el JWT sigue siendo válido.
 *
 * Uso:
 *   RESET_USERNAME=juan pnpm reset-password
 *   RESET_USERNAME=juan RESET_PASSWORD='...' pnpm reset-password
 *
 * Sin RESET_PASSWORD genera una contraseña temporal fuerte y la imprime una
 * sola vez.
 */

/** Contraseña temporal legible pero no adivinable. Cumple la política de la app. */
function generarPasswordTemporal(): string {
  // base64url sobre 12 bytes → 16 caracteres sin símbolos ambiguos para dictar.
  return randomBytes(12).toString('base64url');
}

@Injectable()
class ResetPasswordService {
  constructor(private readonly dataSource: DataSource) {}

  async run(): Promise<void> {
    const username = process.env.RESET_USERNAME;
    if (!username) {
      throw new Error(
        'Falta RESET_USERNAME en el entorno. Ej: RESET_USERNAME=juan pnpm reset-password',
      );
    }

    const generada = !process.env.RESET_PASSWORD;
    const password = process.env.RESET_PASSWORD ?? generarPasswordTemporal();
    const ejecutor = process.env.RESET_EJECUTOR ?? 'cli';
    const reactivar = process.env.RESET_ACTIVAR === 'true';
    const horasVigencia = Number(process.env.RESET_HORAS ?? 24);
    if (!Number.isFinite(horasVigencia) || horasVigencia <= 0) {
      throw new Error('RESET_HORAS debe ser un número de horas mayor que cero');
    }
    const expiraEn = new Date(Date.now() + horasVigencia * 3600_000);

    // La política es la misma que aplica el cambio de contraseña de la app:
    // una contraseña puesta por CLI no puede ser más débil que una puesta por
    // el propio usuario.
    AuthService.validarPoliticaPassword(password, username);
    // Solo si la eligió una persona: la generada son 96 bits de aleatoriedad,
    // no puede estar en una filtración y consultarla sería una llamada al pedo.
    if (!generada) {
      await AuthService.validarPasswordNoFiltrada(password);
    }

    const passwordHash = await AuthService.hashPassword(password);

    // Contraseña y auditoría en la misma transacción: un reset que no queda
    // registrado es exactamente lo que no queremos, así que si falla el
    // registro tampoco se cambia la contraseña.
    await this.dataSource.transaction(async (manager) => {
      const usuario = await manager.findOne(Usuario, { where: { username } });
      if (!usuario) {
        throw new Error(
          `El usuario "${username}" no existe. Para crear uno nuevo usá create-admin.`,
        );
      }

      if (!usuario.activo && !reactivar) {
        throw new Error(
          `El usuario "${username}" está desactivado: cambiarle la contraseña no le devuelve el acceso. ` +
            'Si querés reactivarlo en la misma operación, agregá RESET_ACTIVAR=true.',
        );
      }

      await manager.update(
        Usuario,
        { id: usuario.id },
        {
          passwordHash,
          // Mismo incremento que AuthRepository.updatePasswordAndRevoke:
          // revoca todos los tokens emitidos hasta ahora.
          tokenVersion: () => '"tokenVersion" + 1',
          // La puso un administrador: el dueño la cambia antes de poder usar
          // el sistema, y vence si no lo hace a tiempo.
          debeCambiarPassword: true,
          passwordTemporalExpiraEn: expiraEn,
          ...(reactivar ? { activo: true } : {}),
        },
      );

      await manager.save(
        manager.create(Auditoria, {
          usuario: ejecutor,
          accion: 'RESET_PASSWORD',
          entidad: 'usuarios',
          entidadId: usuario.id,
          detalle: {
            usernameAfectado: usuario.username,
            rol: usuario.rol,
            passwordGenerada: generada,
            reactivado: reactivar && !usuario.activo,
            sesionesRevocadas: true,
            expiraEn: expiraEn.toISOString(),
            horasVigencia,
          },
        }),
      );

      console.log(`Contraseña restablecida para "${usuario.username}".`);
      if (reactivar && !usuario.activo) {
        console.log('El usuario fue reactivado.');
      }
      console.log('Todas las sesiones abiertas quedaron revocadas.');
    });

    if (generada) {
      console.log('');
      console.log('  Contraseña temporal: ' + password);
      console.log('');
      console.log('Se muestra una sola vez: entregala por un canal seguro.');
    }
    console.log(
      `Vence en ${horasVigencia} h (${expiraEn.toLocaleString('es-CO')}).`,
    );
    console.log(
      'Hasta que la cambie, la persona no puede usar el resto del sistema.',
    );
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('DATABASE_URL');
        const ssl = resolverDbSsl({
          DATABASE_URL: url,
          DATABASE_SSL: config.get<boolean>('DATABASE_SSL'),
          DATABASE_SSL_INSECURE: config.get<boolean>('DATABASE_SSL_INSECURE'),
        });
        return {
          type: 'postgres' as const,
          ...(url
            ? { url }
            : {
                host: config.get<string>('DATABASE_HOST'),
                port: config.get<number>('DATABASE_PORT'),
                username: config.get<string>('DATABASE_USERNAME'),
                password: config.get<string>('DATABASE_PASSWORD'),
                database: config.get<string>('DATABASE_DATABASE'),
              }),
          ssl,
          entities: [Usuario, Operario, Auditoria],
          synchronize: false,
        };
      },
    }),
  ],
  providers: [ResetPasswordService],
})
class ResetPasswordModule {}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(ResetPasswordModule, {
    logger: ['error', 'warn'],
  });

  try {
    await app.get(ResetPasswordService).run();
  } catch (error) {
    console.error(
      'Error:',
      error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void bootstrap();

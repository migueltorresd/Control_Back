import { Module, Injectable } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { envValidationSchema } from '../config/env.validation';
import { resolverDbSsl } from '../config/db-ssl';
import { Usuario } from '../modules/auth/entities/usuario.entity';
import { Operario } from '../modules/operarios/entities/operario.entity';
import { Auditoria } from '../modules/auditoria/entities/auditoria.entity';
import { Rol } from '../modules/auth/enums/rol.enum';

/**
 * Cambia el rol de un usuario existente.
 *
 * Promover a SUPER_ADMIN es la operación más sensible del sistema: le da a una
 * cuenta poder sobre las demás. Por eso no se hace con un UPDATE a mano contra
 * la base, sino con un comando que valida, revoca sesiones y deja rastro.
 *
 * Uso:
 *   SET_ROL_USERNAME=miguel SET_ROL=SUPER_ADMIN SET_ROL_EJECUTOR=miguel pnpm set-rol
 */
@Injectable()
class SetRolService {
  constructor(private readonly dataSource: DataSource) {}

  async run(): Promise<void> {
    const username = process.env.SET_ROL_USERNAME;
    const rolNuevo = process.env.SET_ROL as Rol | undefined;
    const ejecutor = process.env.SET_ROL_EJECUTOR ?? 'cli';

    if (!username || !rolNuevo) {
      throw new Error(
        'Faltan SET_ROL_USERNAME y/o SET_ROL. Ej: SET_ROL_USERNAME=miguel SET_ROL=SUPER_ADMIN',
      );
    }

    const validos = Object.values(Rol);
    if (!validos.includes(rolNuevo)) {
      throw new Error(
        `Rol inválido "${rolNuevo}". Válidos: ${validos.join(', ')}`,
      );
    }

    await this.dataSource.transaction(async (manager) => {
      const usuario = await manager.findOne(Usuario, { where: { username } });
      if (!usuario) {
        throw new Error(`El usuario "${username}" no existe.`);
      }

      if (usuario.rol === rolNuevo) {
        console.log(`"${username}" ya tiene el rol ${rolNuevo}. Sin cambios.`);
        return;
      }

      const rolAnterior = usuario.rol;

      await manager.update(
        Usuario,
        { id: usuario.id },
        {
          rol: rolNuevo,
          // El rol viaja dentro del JWT: sin revocar, la sesión abierta seguiría
          // operando con los permisos viejos hasta que expire el token.
          tokenVersion: () => '"tokenVersion" + 1',
        },
      );

      await manager.save(
        manager.create(Auditoria, {
          usuario: ejecutor,
          accion: 'CAMBIO_ROL',
          entidad: 'usuarios',
          entidadId: usuario.id,
          detalle: {
            usernameAfectado: usuario.username,
            rolAnterior,
            rolNuevo,
            sesionesRevocadas: true,
          },
        }),
      );

      console.log(`"${username}": ${rolAnterior} → ${rolNuevo}`);
      console.log(
        'Sus sesiones abiertas quedaron revocadas: debe entrar de nuevo.',
      );
    });
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
  providers: [SetRolService],
})
class SetRolModule {}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(SetRolModule, {
    logger: ['error', 'warn'],
  });

  try {
    await app.get(SetRolService).run();
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

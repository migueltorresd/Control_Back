import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { envValidationSchema } from '../config/env.validation';
import { Usuario } from '../modules/auth/entities/usuario.entity';
import { Operario } from '../modules/operarios/entities/operario.entity';
import { AuthService } from '../modules/auth/auth.service';
import { Rol } from '../modules/auth/enums/rol.enum';

@Injectable()
class CreateAdminService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
  ) {}

  async run(): Promise<void> {
    const username = process.env.ADMIN_USERNAME;
    const password = process.env.ADMIN_PASSWORD;

    if (!username || !password) {
      throw new Error(
        'Faltan las variables ADMIN_USERNAME y/o ADMIN_PASSWORD en el entorno (.env)',
      );
    }

    const existente = await this.usuarioRepo.findOne({ where: { username } });
    if (existente) {
      throw new Error(`El usuario "${username}" ya existe. No se creó nada.`);
    }

    // Misma política de contraseña que el cambio de contraseña de la app
    AuthService.validarPoliticaPassword(password, username);

    const admin = this.usuarioRepo.create({
      username,
      passwordHash: await AuthService.hashPassword(password),
      rol: Rol.ADMIN,
      operarioId: null,
      activo: true,
    });
    await this.usuarioRepo.save(admin);
    console.log(`Usuario administrador "${username}" creado correctamente.`);
    console.log('Recomendación: cambie la contraseña en el primer uso.');
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
        const ssl =
          config.get<boolean>('DATABASE_SSL') ||
          url?.includes('sslmode=require')
            ? { rejectUnauthorized: false }
            : false;
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
          entities: [Usuario, Operario],
          synchronize: false,
        };
      },
    }),
    TypeOrmModule.forFeature([Usuario]),
  ],
  providers: [CreateAdminService],
})
class CreateAdminModule {}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(CreateAdminModule, {
    logger: ['error', 'warn'],
  });

  try {
    await app.get(CreateAdminService).run();
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

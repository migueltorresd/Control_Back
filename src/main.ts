import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: false,
    bodyParser: false, // se configura abajo con límite de tamaño
  });
  const configService = app.get(ConfigService);

  // API versionada: todo cuelga de /api/v1
  app.setGlobalPrefix('api/v1');

  // Cabeceras de seguridad
  app.use(helmet());

  // Límite de tamaño del body JSON
  app.useBodyParser('json', { limit: '1mb' });

  // CORS restringido a los orígenes configurados (separados por comas)
  const corsOrigin = configService.getOrThrow<string>('CORS_ORIGIN');
  app.enableCors({ origin: corsOrigin.split(',').map((o) => o.trim()) });

  // Validación global estricta
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Remueve propiedades que no estén en el DTO
      forbidNonWhitelisted: true, // Lanza error si hay propiedades no permitidas
      transform: true, // Transforma automáticamente los payloads a los tipos del DTO
    }),
  );

  // Filtro global de excepciones
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = configService.get<number>('PORT') ?? 3001;
  await app.listen(port);
}
void bootstrap();

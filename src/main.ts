import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
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

  // Determinar si se expone la documentación de Swagger
  const isProd = configService.get<string>('NODE_ENV') === 'production';
  const swaggerEnabled = configService.get<boolean>('SWAGGER_ENABLED') ?? false;
  const showSwagger = !isProd || swaggerEnabled;

  // Cabeceras de seguridad (desactivamos CSP únicamente si Swagger está activo para que carguen sus estilos/scripts inline)
  app.use(
    helmet({
      contentSecurityPolicy: showSwagger ? false : undefined,
    }),
  );

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

  // Configuración de Swagger (solo en desarrollo o si está explícitamente habilitado)
  if (showSwagger) {
    const config = new DocumentBuilder()
      .setTitle('Control de Producción API')
      .setDescription(
        'Documentación interactiva de la API para el sistema de Control de Producción del Taller.',
      )
      .setVersion('1.0')
      .addBearerAuth({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Ingrese el token JWT obtenido del login',
        in: 'header',
      })
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = configService.get<number>('PORT') ?? 3001;
  await app.listen(port);
}
void bootstrap();

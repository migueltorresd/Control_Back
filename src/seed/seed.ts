import { NestFactory } from '@nestjs/core';
import { SeedModule } from './seed.module';
import { SeedService } from './seed.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(SeedModule, {
    logger: ['error', 'warn'],
  });

  try {
    const seedService = app.get(SeedService);
    await seedService.seed();
  } catch (error) {
    console.error('Error durante el seed:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

void bootstrap();

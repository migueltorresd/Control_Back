import { Controller, Get } from '@nestjs/common';
import {
  HealthCheckService,
  TypeOrmHealthIndicator,
  HealthCheck,
} from '@nestjs/terminus';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Versión leída del package.json en tiempo de ejecución.
 *
 * NO con `import ... from '../../../package.json'`: eso mete el archivo en el
 * programa de TypeScript, le corre el `rootDir` a todo el build y el compilado
 * pasa de `dist/main.js` a `dist/src/main.js`. Render arranca con
 * `node dist/main`, así que la API directamente no levanta. Probado.
 *
 * `__dirname` resuelve a `src/modules/health` en desarrollo y a
 * `dist/modules/health` compilado; en los dos casos, tres niveles arriba está
 * la raíz del proyecto. Mismo truco que usa el PDF del vale para su logo.
 */
const VERSION: string = (() => {
  try {
    const raw = readFileSync(
      join(__dirname, '..', '..', '..', 'package.json'),
      'utf8',
    );
    return (JSON.parse(raw) as { version?: string }).version ?? 'desconocida';
  } catch {
    // Nunca vale la pena tumbar el health check por no saber la versión.
    return 'desconocida';
  }
})();

@ApiTags('Monitoreo')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
  ) {}

  @Get()
  @Public()
  @HealthCheck()
  @ApiOperation({
    summary:
      'Verificar el estado de salud del servidor y la base de datos (Público)',
  })
  async check() {
    const resultado = await this.health.check([
      () => this.db.pingCheck('database', { timeout: 3000 }),
    ]);
    /**
     * La versión del código que está corriendo de verdad, no la del repo.
     *
     * Es la única forma de saber desde afuera si un despliegue llegó. El
     * 23-08-2026 el frontend salió a producción antes que la API y no había
     * manera de confirmarlo sin entrar al dashboard de Render: con esto se
     * responde con un GET.
     */
    return { ...resultado, version: VERSION };
  }
}

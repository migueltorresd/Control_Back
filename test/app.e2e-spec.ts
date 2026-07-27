// Apuntar a la BD de test ANTES de que ConfigModule lea el entorno
import {
  prepararBaseDeDatosDeTest,
  urlBaseDeDatosDeTest,
  TEST_DB,
} from './utils/test-db';

process.env.DATABASE_DATABASE = TEST_DB;
// La app prefiere DATABASE_URL sobre las variables sueltas: se sobreescribe
// con la de test para que el e2e nunca corra contra una BD del entorno/.env.
process.env.DATABASE_URL = urlBaseDeDatosDeTest();

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './../src/app.module';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter';
import { AuthService } from './../src/modules/auth/auth.service';
import { Usuario } from './../src/modules/auth/entities/usuario.entity';
import { Rol } from './../src/modules/auth/enums/rol.enum';

const ADMIN_USER = 'admin-e2e';
const ADMIN_PASS = 'ClaveDePruebas2026';

// Shapes de las respuestas del API que el test consume
interface LoginBody {
  accessToken: string;
  usuario: { username: string; rol: string };
}
interface RegistroView {
  id: string;
  operarioId: string;
  pares: number;
  estado: string;
  montoPagado: number;
}
interface ValeView {
  vale: string;
  produccion: Record<string, RegistroView[]>;
}
interface PagoView {
  id: string;
  monto: number;
}
interface ErrorBody {
  message: string;
}

describe('Flujo de negocio completo (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;
  let regId: string;

  const auth = () => ({ Authorization: `Bearer ${token}` });
  const getVale = async (): Promise<ValeView> => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/vales/V-0001')
      .set(auth())
      .expect(200);
    return res.body as ValeView;
  };

  beforeAll(async () => {
    await prepararBaseDeDatosDeTest();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Mismo setup que main.ts (prefijo, validación, filtro)
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());

    // Configurar Swagger en la app de E2E
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Control de Producción API')
      .setDescription('Documentación de la API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, swaggerDocument);

    await app.init();

    // Crear el admin de pruebas directo en la BD de test
    const ds = app.get(DataSource);
    await ds.getRepository(Usuario).save({
      username: ADMIN_USER,
      passwordHash: await AuthService.hashPassword(ADMIN_PASS),
      rol: Rol.ADMIN,
      operarioId: null,
      activo: true,
    });
  }, 60000);

  afterAll(async () => {
    await app.close();
  });

  it('fail-closed: GET /vales sin token → 401', () => {
    return request(app.getHttpServer()).get('/api/v1/vales').expect(401);
  });

  it('login del admin → token', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: ADMIN_USER, password: ADMIN_PASS })
      .expect(200);
    const body = res.body as LoginBody;
    expect(body.usuario.rol).toBe('ADMIN');
    token = body.accessToken;
  });

  it('catálogo mínimo: referencia con tarifa y operario', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/referencias')
      .set(auth())
      .send({
        nombre: 'Modelo E2E',
        precioVenta: 95000,
        linea: 'Pruebas',
        tarifas: [{ oficio: 'Cortador', valor: 1200 }],
        receta: [],
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/operarios')
      .set(auth())
      .send({ nombre: 'Pedro E2E', oficio: 'Cortador', antiguedad: 2020 })
      .expect(201);
  });

  it('crear vale → V-0001 (secuencia desde cero)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/vales')
      .set(auth())
      .send({
        almacen: 'Principal',
        color: 'Negro',
        altura: 'Media',
        ref: 'REF-001',
        tallas: { '40': 4 },
      })
      .expect(201);
    expect((res.body as ValeView).vale).toBe('V-0001');
  });

  it('tallas inválidas → 400 con mensaje en español', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/vales')
      .set(auth())
      .send({
        almacen: 'P',
        color: 'N',
        altura: 'M',
        ref: 'REF-001',
        tallas: { abc: -1 },
      })
      .expect(400);
    expect((res.body as ErrorBody).message).toContain('no es válida');
  });

  it('registrar producción → estado registrado', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/vales/V-0001/registro')
      .set(auth())
      .send({ etapa: 'Cortador', operarioId: 'OP-01', pares: 4 })
      .expect(201);
    const body = res.body as RegistroView;
    expect(body.estado).toBe('registrado');
    regId = body.id;
  });

  it('aprobar → congela el monto (pares × tarifa)', async () => {
    // Intentar cambiar a aprobado mediante PATCH directo debe fallar con 400
    await request(app.getHttpServer())
      .patch(`/api/v1/vales/V-0001/registro/${regId}`)
      .set(auth())
      .send({ estado: 'aprobado' })
      .expect(400);

    // Aprobar a través del endpoint de revisión
    await request(app.getHttpServer())
      .post(`/api/v1/vales/V-0001/registro/${regId}/revision`)
      .set(auth())
      .send({ paresAprobados: 4 })
      .expect(201);

    const reg = (await getVale()).produccion.Cortador[0];
    expect(reg.estado).toBe('aprobado');
    expect(reg.montoPagado).toBe(4800); // 4 × 1200
  });

  it('pagar → comprobante con el monto congelado y registro pagado', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/pagos/${regId}`)
      .set(auth())
      .expect(201);

    const pagosRes = await request(app.getHttpServer())
      .get('/api/v1/pagos')
      .set(auth())
      .expect(200);
    const pagos = pagosRes.body as PagoView[];
    expect(pagos).toHaveLength(1);
    expect(pagos[0].monto).toBe(4800); // monto congelado

    expect((await getVale()).produccion.Cortador[0].estado).toBe('pagado');
  });

  it('pagar dos veces el mismo registro → 400', () => {
    return request(app.getHttpServer())
      .post(`/api/v1/pagos/${regId}`)
      .set(auth())
      .expect(400);
  });

  it('anular el pago → registro vuelve a aprobado y sin comprobantes', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/pagos/anular/${regId}`)
      .set(auth())
      .expect(201);

    expect((await getVale()).produccion.Cortador[0].estado).toBe('aprobado');

    const pagosRes = await request(app.getHttpServer())
      .get('/api/v1/pagos')
      .set(auth());
    expect(pagosRes.body as PagoView[]).toHaveLength(0);
  });

  it('exceder el cupo del vale → 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/vales/V-0001/registro')
      .set(auth())
      .send({ etapa: 'Cortador', operarioId: 'OP-01', pares: 1 })
      .expect(400);
    expect((res.body as ErrorBody).message).toContain('Cupo superado');
  });

  it('auditoría: GET /auditoria sin token → 401', () => {
    return request(app.getHttpServer()).get('/api/v1/auditoria').expect(401);
  });

  it('auditoría: GET /auditoria con token → retorna las acciones registradas en orden descendente', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/auditoria')
      .set(auth())
      .expect(200);

    const body = res.body as {
      data: Array<{
        usuario: string;
        accion: string;
        entidad: string;
        entidadId: string;
        detalle: unknown;
      }>;
      total: number;
      page: number;
      limit: number;
    };

    expect(body.total).toBeGreaterThanOrEqual(3);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(20);

    const acciones = body.data.map((d) => d.accion);
    expect(acciones).toContain('APROBAR_PRODUCCION');
    expect(acciones).toContain('PAGAR');
    expect(acciones).toContain('ANULAR_PAGO');

    // Comprobar que el usuario es el administrador de pruebas
    const pagoAudit = body.data.find((d) => d.accion === 'PAGAR');
    expect(pagoAudit).toBeDefined();
    expect(pagoAudit?.usuario).toBe(ADMIN_USER);
    expect(pagoAudit?.entidad).toBe('Pago');
  });

  it('swagger: GET /api/docs/ → responde 200 OK con la interfaz HTML', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/docs/')
      .expect(200);
    expect(res.text).toContain('<html');
    expect(res.text).toContain('swagger-ui');
  });

  it('health check: GET /api/v1/health → responde 200 OK y database status up sin token', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);

    const body = res.body as {
      status: string;
      info: Record<string, { status: string }>;
    };
    expect(body.status).toBe('ok');
    expect(body.info.database.status).toBe('up');
  });

  it('paginación opt-in: GET /vales sin params → array (modo legacy)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/vales')
      .set(auth())
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('paginación opt-in: GET /vales?page=1&limit=5 → envelope con total', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/vales?page=1&limit=5')
      .set(auth())
      .expect(200);
    const body = res.body as {
      data: unknown[];
      total: number;
      page: number;
      limit: number;
    };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(5);
    expect(body.total).toBeGreaterThanOrEqual(1);
  });

  it('paginación: GET /vales?limit=999 → 400 (excede el máximo)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/vales?limit=999')
      .set(auth())
      .expect(400);
  });

  it('filtro de fecha: GET /pagos?desde&hasta → envelope filtrado', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/pagos?desde=2000-01-01&hasta=2000-12-31')
      .set(auth())
      .expect(200);
    const body = res.body as { data: unknown[]; total: number };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.total).toBe(0); // ningún pago en el año 2000
  });

  // --- Imagen del modelo (persistida en la BD, no en disco) ---

  const PNG_E2E = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(16),
  ]);

  it('imagen: contenido que no es imagen → 400 aunque declare mimetype válido', () => {
    return request(app.getHttpServer())
      .post('/api/v1/referencias/REF-001/imagen')
      .set(auth())
      .attach('imagen', Buffer.from('<?php echo "malicioso"; ?>'), {
        filename: 'foto.png',
        contentType: 'image/png',
      })
      .expect(400);
  });

  it('imagen: subir PNG → tieneImagen true con extensión decidida por el servidor', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/referencias/REF-001/imagen')
      .set(auth())
      .attach('imagen', PNG_E2E, {
        filename: 'nombre-enganoso.php',
        contentType: 'image/png',
      })
      .expect(201);
    const body = res.body as { tieneImagen: boolean; imagenExt: string };
    expect(body.tieneImagen).toBe(true);
    expect(body.imagenExt).toBe('png');
  });

  it('imagen: GET público devuelve el binario desde la BD con ETag', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/referencias/REF-001/imagen')
      .expect(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(res.headers.etag).toBeDefined();
    expect(Buffer.compare(res.body as Buffer, PNG_E2E)).toBe(0);

    // Revalidación: mismo ETag → 304 sin volver a bajar el binario
    await request(app.getHttpServer())
      .get('/api/v1/referencias/REF-001/imagen')
      .set('If-None-Match', res.headers.etag)
      .expect(304);
  });

  it('imagen: DELETE limpia flag y binario → GET posterior 404', async () => {
    await request(app.getHttpServer())
      .delete('/api/v1/referencias/REF-001/imagen')
      .set(auth())
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/referencias/REF-001/imagen')
      .expect(404);
  });

  // --- Revocación de sesiones (al final: mata el token compartido del suite) ---

  const ADMIN_PASS_NUEVA = 'NuevaClaveSegura2026';

  it('revocación: cambiar contraseña → el token viejo muere aunque no expiró', async () => {
    // El token funciona antes del cambio
    await request(app.getHttpServer())
      .get('/api/v1/vales')
      .set(auth())
      .expect(200);

    await request(app.getHttpServer())
      .patch('/api/v1/auth/password')
      .set(auth())
      .send({ passwordActual: ADMIN_PASS, passwordNueva: ADMIN_PASS_NUEVA })
      .expect(200);

    // El mismo token (firmado y sin expirar) ahora es rechazado
    await request(app.getHttpServer())
      .get('/api/v1/vales')
      .set(auth())
      .expect(401);
  });

  it('revocación: re-login con la contraseña nueva → token nuevo funciona', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: ADMIN_USER, password: ADMIN_PASS_NUEVA })
      .expect(200);
    token = (res.body as LoginBody).accessToken;

    await request(app.getHttpServer())
      .get('/api/v1/vales')
      .set(auth())
      .expect(200);
  });
});

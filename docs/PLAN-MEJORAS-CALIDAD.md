# Plan de mejoras — Seguridad y atributos de calidad

> Análisis del workspace realizado el 2026-06-10.
> Alcance: backend NestJS (`Control_produccion_back`) y frontend React/Vite (`control-produccion`, en `e:\proyectos\control-produccion`).
> Cada ítem tiene checkbox para marcar avance. Prioridades: 🔴 Crítico · 🟠 Alto · 🟡 Medio · 🟢 Bajo.

**Plan hermano del frontend** (análisis y tareas específicas del proyecto React): `e:\proyectos\control-produccion\docs\PLAN-MEJORAS-FRONT.md` — incluye el hallazgo F1 (montos congelados), que también toca este backend.

**Cómo usar este documento con una IA:** las secciones de hallazgos (🔴→🟢) explican el *qué* y el *por qué*; las secciones de visión y patrones definen el *cómo* (convenciones obligatorias); y la **Guía de implementación** al final es el plan ejecutable — pídele a la IA una tarea a la vez (p. ej. "implementa la tarea 1.2 del documento docs/PLAN-MEJORAS-CALIDAD.md respetando las reglas para el implementador"), verifica el criterio de aceptación, marca el checkbox y haz commit antes de seguir con la siguiente.

---

## Resumen ejecutivo

El proyecto tiene una base sólida: arquitectura modular limpia (controller → service → repository), DTOs con `class-validator`, `ValidationPipe` global estricto, máquina de estados de producción bien pensada y pagos transaccionales. Sin embargo, **no está listo para entregarse a un cliente en producción** por cuatro razones principales:

1. **No existe autenticación ni autorización** — cualquiera con acceso a la red puede crear pagos, anular pagos y borrar registros.
2. **`synchronize: true` en TypeORM** — el esquema se altera automáticamente al arrancar; riesgo real de pérdida de datos del cliente.
3. **Condiciones de carrera en generación de IDs y validaciones de negocio** — colisiones de ID y sobre-registro de producción bajo uso concurrente.
4. **Cero tests** — no hay ninguna prueba unitaria ni e2e que respalde la lógica de negocio (que es justamente lo más valioso: estados, tarifas, pagos).

---

## 🔴 Crítico — bloqueante para entrega

### 1. Implementar autenticación y autorización
- [ ] La API está completamente abierta: `POST /pagos/:regId`, `POST /pagos/anular/:regId`, `DELETE /vales/:id/registro/:regId`, etc. no requieren ninguna credencial.
- [ ] Añadir `@nestjs/passport` + `@nestjs/jwt` (o al menos una API key si el cliente es un solo usuario interno).
- [ ] Guard global (`APP_GUARD`) con rutas públicas explícitas vía decorador `@Public()`.
- [ ] Si hay varios perfiles (administrador vs. registrador de producción), añadir roles: solo un rol autorizado debería aprobar producción y ejecutar/anular pagos.
- [ ] Frontend: pantalla de login, almacenamiento del token y envío en header `Authorization`.

#### 1.1 Recomendación: JWT propio (sin servicios de pago)

Para una empresa de ~10 personas, **JWT autogestionado con NestJS es la opción correcta**: costo cero (no requiere Auth0, Cognito ni Firebase, que serían sobreingeniería y dependencia externa innecesaria a esta escala), confiable y es el camino estándar/documentado de NestJS.

**Stack concreto (todo gratuito, sin servicios externos):**

| Pieza | Elección | Por qué |
|-------|----------|---------|
| Tokens | `@nestjs/jwt` + `@nestjs/passport` + `passport-jwt` | Estándar de NestJS, mantenido por el core team |
| Hash de contraseñas | `bcrypt` | Probado por décadas, suficiente a esta escala (`argon2` también vale, pero bcrypt tiene menos fricción en Windows) |
| Usuarios | Tabla `usuarios` propia en la misma PostgreSQL | Sin dependencias nuevas; 10 usuarios no justifican un IdP |
| Secreto JWT | Variable de entorno `JWT_SECRET` (mínimo 32 caracteres aleatorios) | Validada al arrancar junto con el resto del env (ver ítem 8) |

**Diseño pensado para el roadmap (admin hoy, operarios mañana):**

- [ ] Entidad `Usuario`: `id`, `username`, `passwordHash`, `rol` (`ADMIN` \| `OPERARIO`), `operarioId` (nullable, FK a `operarios`) y `activo`. El campo `operarioId` queda listo para cuando los operarios tengan acceso: vincula la cuenta con su registro de operario y permite validar que solo actualicen **sus** registros de producción.
- [ ] Incluir `rol` (y `operarioId` si existe) como claims dentro del JWT, para autorizar sin consultar la BD en cada request.
- [ ] **Implementar los roles desde el día uno aunque solo exista el admin**: decorador `@Roles(Rol.ADMIN)` + `RolesGuard` global junto al `JwtAuthGuard`. Así, habilitar operarios a futuro es solo crear sus usuarios y marcar qué endpoints les corresponden — sin re-arquitectura.
- [ ] Reparto de permisos previsto:
  - `ADMIN`: todo (CRUD completo, aprobar producción, pagar/anular, ventas, ajustes).
  - `OPERARIO` (futuro): leer vales y **registrar/actualizar su propia producción** (`POST/PATCH /vales/:id/registro`), nunca aprobar, pagar ni borrar. La aprobación y el pago quedan siempre en manos del admin — eso protege la caja.
- [ ] Tokens: con un solo admin basta un access token de vida media (p. ej. 8–12 h, una jornada laboral) **sin** refresh tokens — menos código y menos superficie de error. Cuando entren los operarios, evaluar acortar la vida del token y añadir refresh si se vuelve incómodo.
- [ ] Crear el usuario admin inicial mediante script/seed controlado (contraseña desde variable de entorno, forzar cambio en primer uso), nunca hardcodeada.
- [ ] Login con rate limiting (`@nestjs/throttler` del ítem 7 aplicado agresivamente a `POST /auth/login`) para frenar fuerza bruta.

**Qué NO hace falta a esta escala:** OAuth/social login, multi-tenancy, SSO, MFA obligatorio (opcional si el cliente lo pide), Auth0/Cognito/Keycloak. Todo eso añade costo o complejidad sin beneficio para 10 usuarios internos.

**Nota de arquitectura (mirando la landing futura):** los usuarios internos (admin/operarios) y los eventuales **clientes compradores de la landing son dos poblaciones distintas** y no deben compartir tabla ni rol. Si la tienda llega, se crea una entidad `Cliente` separada con su propio flujo de registro, y los JWT se emiten con `audience` distinto (`backoffice` vs `storefront`), de modo que un token de cliente jamás abra endpoints de producción/pagos. La decisión de hoy (módulo `auth` propio con guards por rol) escala a ese escenario sin reescritura — solo se añade una estrategia más. Ver la sección de visión arquitectónica al final del documento.

### 2. Eliminar `synchronize: true` y adoptar migraciones
- [ ] `src/app.module.ts:36` usa `synchronize: true` sin condición. En producción esto puede **borrar o alterar columnas con datos del cliente** ante cualquier cambio de entidad.
- [ ] Bug adicional: `src/config/database.config.ts:10` tiene `process.env.DATABASE_SYNCHRONIZE === 'true' || true`, que **siempre evalúa a `true`** sin importar la variable (además, este config registrado con `registerAs('database')` no se está usando en `app.module.ts` — está duplicado y muerto).
- [ ] Configurar TypeORM migrations: `migration:generate` / `migration:run`, y generar la migración inicial a partir del esquema actual.
- [ ] `synchronize` debe quedar en `false` siempre; en desarrollo se puede permitir vía variable de entorno explícita.

### 3. Desactivar el seed automático en producción
- [ ] `SeedService.onModuleInit()` corre en **cada arranque** e inserta datos de demostración (operarios ficticios, vales, pagos) si la BD está vacía. En la BD del cliente esto contaminaría datos reales tras un reset o instalación limpia.
- [ ] Mover el seed a un script separado (`pnpm seed`) o condicionarlo a `NODE_ENV !== 'production'` / flag `SEED_ON_BOOT=true`.

### 4. Corregir el filtro global de excepciones (fuga de información + enmascaramiento de errores)
- [ ] `src/common/filters/http-exception.filter.ts:31-35` convierte **cualquier `Error` no-HTTP en 400 y expone `exception.message` al cliente**. Los errores de TypeORM/pg (violaciones de constraint, SQL fallido) revelan nombres de tablas/columnas y detalles internos → fuga de información.
- [ ] Además enmascara errores de programación reales como si fueran errores del usuario (400 en vez de 500), lo que dificulta el diagnóstico.
- [ ] Solución: solo las `HttpException` devuelven su mensaje; cualquier otro error → 500 con mensaje genérico, registrando el detalle completo en el log del servidor (con stack trace).

---

## 🟠 Alto — corregir antes de la entrega

### 5. Condiciones de carrera en generación de IDs secuenciales
- [ ] `ValesService.create()` (`vales.service.ts:39-47`) y `VentasService.create()` (`ventas.service.ts:32-43`) hacen *read-then-write* (`findLast()` → calcular siguiente → insertar). Dos peticiones simultáneas generan el **mismo ID** → violación de PK o sobrescritura.
- [ ] En `vales.service.ts:44` si `last.id` está malformado, `parseInt` produce `NaN` y el ID resultante es `V-0NaN` (Ventas sí lo valida; Vales no).
- [ ] Los IDs de pago `PG-${Date.now()}-...` pueden colisionar en lotes concurrentes.
- [ ] Solución recomendada: secuencia de PostgreSQL (`CREATE SEQUENCE`) o columna identity interna + ID de presentación derivado; alternativamente, generar el ID dentro de la transacción con bloqueo (`SELECT ... FOR UPDATE`).

### 6. Validaciones de negocio no transaccionales
- [ ] `ProduccionService.registerProduccion()` (`produccion.service.ts:36-43`): la validación de cupo (`sumParesByValeAndEtapa` + insert) no está dentro de una transacción → dos registros simultáneos pueden **superar el cupo del vale**.
- [ ] `PagosService.pagarLote()` (`pagos.service.ts:53-94`): valida los estados **fuera** de la transacción; el estado puede cambiar entre la validación y el commit (doble pago del mismo registro). Releer y validar los registros **dentro** de la transacción con lock pesimista.
- [ ] `updateEstado` debería verificar el estado actual de forma atómica (p. ej. `UPDATE ... WHERE estado = :estadoActual` y comprobar `affected`).

### 7. Endurecer la configuración HTTP del backend
- [ ] `app.enableCors()` sin opciones (`main.ts:8`) permite **cualquier origen**. Restringir a la(s) URL(s) del frontend vía variable de entorno (`CORS_ORIGIN`).
- [ ] Añadir `helmet` para cabeceras de seguridad.
- [ ] Añadir rate limiting con `@nestjs/throttler` (especialmente si se expone a internet).
- [ ] Limitar el tamaño del body JSON (`app.use(json({ limit: '...' }))`).

### 8. Validación de variables de entorno al arrancar
- [ ] Hoy, si falta una variable, se usan silenciosamente los defaults `postgres/postgres` (`app.module.ts:30-34`) — en producción se conectaría con credenciales débiles sin avisar.
- [ ] Usar `ConfigModule.forRoot({ validationSchema })` con Joi (o zod) para que la app **falle al arrancar** si faltan variables, y eliminar los fallbacks de credenciales del código.
- [ ] Crear `.env.example` versionado (sin secretos) documentando todas las variables: `DATABASE_*`, `PORT`, `CORS_ORIGIN`, `NODE_ENV`, secretos JWT, etc.

### 9. Suite de pruebas (hoy: 0 tests)
- [ ] Unit tests de la lógica crítica: máquina de estados de `ProduccionService.updateEstado` (todas las transiciones válidas e inválidas), cálculo/congelado de montos, validación de cupo, `pagarLote` con inconsistencias.
- [ ] Tests e2e (`supertest`) de los flujos completos: crear vale → registrar producción → aprobar → pagar → anular.
- [ ] Definir un umbral mínimo de cobertura para la lógica de negocio (los módulos `vales`, `pagos`, `produccion` son los importantes).

### 10. Validación incompleta de `tallas` en `CreateValeDto`
- [ ] `create-vale.dto.ts:24-26` solo valida que `tallas` sea un objeto. Acepta valores negativos, decimales, no numéricos y claves no numéricas (`parseInt` en el controller produciría `NaN` como talla).
- [ ] Validar con un validador custom o transformar a un array de `{talla, cantidad}` con `@ValidateNested` + `@IsInt() @IsPositive()` en ambos campos.

---

## 🟡 Medio — calidad y operabilidad

### 11. Observabilidad
- [ ] Reemplazar `console.log` por el `Logger` de NestJS (o `pino` con `nestjs-pino` para logs estructurados JSON).
- [ ] Interceptor de logging de peticiones (método, ruta, status, duración) — clave para soporte post-entrega.
- [ ] Registrar en log todas las operaciones de dinero (pagos, anulaciones) con quién/cuándo — pista de auditoría mínima.
- [ ] Endpoint de health check con `@nestjs/terminus` (`GET /health` con ping a la BD) para monitoreo.

### 12. Documentación de API
- [ ] Añadir `@nestjs/swagger` y decorar DTOs/controladores → `GET /docs` con la API navegable. Facilita la entrega y el mantenimiento futuro.

### 13. Tipado y consistencia de dominio
- [ ] Eliminar los `any`: `mapToFrontend(v: any)` en `vales.controller.ts:78`, los `as any` del seed, `errors: any` en el filtro. Activar `noImplicitAny` (revisar `tsconfig.json`).
- [ ] `Pago.etapa` se guarda como string libre (`'Cortador'` en el seed) mientras producción usa el enum `Oficio` — unificar al enum.
- [ ] `fecha` es `string` en todas las entidades; usar tipo `date` de PostgreSQL con validación `@IsDateString()` en los DTOs (hoy solo se valida `@IsString`).
- [ ] Verificar el manejo de dinero: usar `numeric` en PostgreSQL con el `decimal.transformer` en **todas** las columnas de montos, y definir política de redondeo.

### 14. Paginación y rendimiento
- [ ] `findAll()` de vales/pagos/ventas carga todo con relaciones sin límite. Con datos reales de meses de producción la respuesta crecerá sin control. Añadir paginación (`?page=&limit=`) o al menos filtros por rango de fechas.

### 15. Despliegue
- [ ] `compose.yaml` solo levanta la BD con `postgres/postgres` en texto plano y expone el puerto 5432 al host. Para entrega: leer credenciales de `.env`, no exponer 5432 (o solo en localhost), y añadir el servicio del backend.
- [ ] Crear `Dockerfile` multi-stage para el backend (build → imagen de producción con `node dist/main`).
- [ ] Documentar en el README el procedimiento real de instalación/despliegue para el cliente (requisitos, variables, migraciones, arranque) y la estrategia de **backups de la BD**.
- [ ] Si se expone a internet: HTTPS obligatorio (reverse proxy nginx/caddy o equivalente).

### 16. CI básico
- [ ] GitHub Actions (u otro): `lint` + `build` + `test` + `pnpm audit` en cada push/PR. Evita entregar una versión que ni compila.

---

## 🟢 Bajo — pulido

### 17. Frontend
- [ ] `src/services/api.js:1` tiene `API_URL` hardcodeada a `http://localhost:3001`. Usar `import.meta.env.VITE_API_URL` con fallback para desarrollo.
- [ ] No hay ESLint ni tests en el frontend; añadir al menos ESLint + el build en CI.
- [ ] Revisar manejo de errores de `request()`: el `errorText` crudo del backend se lanza como mensaje — con el filtro corregido (ítem 4) habría que parsear el JSON y mostrar `message` amigable al usuario.

### 18. Higiene del repositorio
- [ ] `package.json`: completar `description`, `author` y revisar `license: UNLICENSED` (¿es lo acordado con el cliente?).
- [ ] Verificar la versión declarada de `typeorm` (`^1.0.0`) — confirmar que es la intencionada y fijar versiones exactas (o lockfile estricto) para builds reproducibles.
- [ ] Ejecutar `pnpm audit` en ambos proyectos y resolver vulnerabilidades conocidas.
- [ ] Añadir `CLAUDE.md` o documentación de arquitectura breve (módulos, flujo vale→producción→pago→venta) para futuros mantenedores.
- [ ] El `.env` local está correctamente ignorado por git (verificado: no está versionado) — mantenerlo así y rotar credenciales reales del cliente fuera del repo.

---

## Visión arquitectónica — escalar hacia una landing / tienda futura

> Principio rector: **monolito modular hoy, fronteras limpias para mañana**. Con 10 usuarios y un posible storefront futuro, lo costoso no es escalar máquinas — es desarmar acoplamientos mal hechos. Nada de microservicios ni infraestructura prematura; sí decisiones baratas hoy que evitan reescrituras después.

### Decisiones que cuestan poco ahora y evitan reescritura después

- [ ] **Versionar la API desde ya**: prefijo global `/api/v1` (`app.setGlobalPrefix` + `enableVersioning`). Cuando exista la landing consumiendo la API pública, podrás evolucionar el back-office sin romperla. Hacerlo después de entregar obliga a migrar el frontend del cliente.
- [ ] **Separar las "dos APIs" lógicamente, no físicamente**: el mismo monolito puede exponer rutas de back-office (protegidas, rol interno) y rutas públicas futuras (`/api/v1/catalogo`, solo lectura). En NestJS esto es un módulo nuevo (`storefront/` o `catalogo-publico/`) que **reutiliza los services existentes pero con sus propios controllers y DTOs de respuesta** — nunca exponer las entidades del dominio interno (tarifas de mano de obra, costos, márgenes) en una respuesta pública. El `mapToFrontend` actual ya apunta en esta dirección; formalizarlo como capa de presentación por audiencia.
- [ ] **Backend 100% stateless**: sin estado en memoria entre requests (los JWT ya lo garantizan; no introducir sesiones en memoria ni caches locales con estado de negocio). Esto hace que escalar horizontalmente sea solo poner instancias detrás del proxy — y conecta con el ítem 5: los IDs deben generarse en la BD (secuencias), porque cualquier generación en memoria se rompe con 2+ instancias.
- [ ] **El dominio ya tiene la semilla del catálogo**: `Referencia` (con `precioVenta`) es el producto, y `Venta` es el embrión de un pedido. Al modelar la tienda: `Referencia` gana campos de publicación (`publicada`, descripción, imágenes) en vez de crear un catálogo paralelo, y los pedidos del storefront serían una entidad `Pedido` propia que *referencia* al dominio de producción — no sobrecargar `Venta` (que hoy es un registro contable interno) con estados de e-commerce (carrito, envío, pago online).
- [ ] **Inventario explícito**: hoy el stock disponible es implícito (producción terminada menos vendido). Una tienda necesita responder "¿hay 3 pares de la talla 40?" de forma confiable y concurrente. Anotar como decisión futura: derivar una vista/tabla de inventario por referencia+talla alimentada por producción y ventas. No construirlo ahora; sí evitar lógica que lo imposibilite (p. ej. borrar registros pagados — ya está prohibido, bien).
- [ ] **Pagos online = proveedor externo, nunca propio**: si la landing vende, integrar pasarela local (Wompi/MercadoPago/PayU según el país) vía webhooks. Jamás almacenar datos de tarjetas (PCI-DSS). El módulo `pagos` actual es de **nómina de operarios** — no mezclarlo con cobros a clientes; serían módulos hermanos con nombres distintos (`pagos-operarios` vs `cobros`).

### Qué NO hacer todavía (deuda intencional, documentada)

| Tentación | Por qué esperar |
|-----------|-----------------|
| Microservicios / colas de mensajes | Un monolito NestJS modular bien hecho atiende miles de usuarios; la fábrica tiene 10. La modularidad actual ya permite extraer un servicio después *si algún día* hace falta. |
| Keycloak / IdP dedicado | Se justifica con SSO o múltiples aplicaciones; hoy añade un servidor más que operar. El módulo `auth` con audiences deja la puerta abierta. |
| GraphQL / API Gateway | REST versionado cubre back-office y storefront. |
| Caché distribuido (Redis) | Solo cuando exista la landing con tráfico real; la primera optimización será caché HTTP del catálogo público, que es trivial de añadir. |
| Multi-tenancy | Es una sola empresa. |

### Camino de crecimiento previsto

```
HOY                 ENTREGA                 FUTURO (landing)
─────               ────────                ─────────────────
API abierta    →    /api/v1 + JWT     →     + módulo storefront (catálogo público,
sin tests           roles ADMIN             audiencia "storefront", solo lectura)
synchronize         migraciones       →     + entidad Cliente + Pedido
                    Docker + proxy    →     + pasarela de pagos (webhooks)
                                            + landing estática (Vite) servida por el
                                              mismo proxy, consumiendo /api/v1
```

La landing en sí conviene que sea un frontend estático separado (otro proyecto Vite o Astro) servido por el mismo reverse proxy — comparte API, no código de UI con el back-office. Cero costo de hosting adicional significativo.

---

## Patrones de diseño y arquitectura

> Regla del arquitecto: un patrón se adopta cuando resuelve un problema que **este** proyecto tiene, no porque aparezca en un libro. Esta sección mapea cada patrón a archivos y problemas concretos del código. Hay tres grupos: los que ya están (mantener y formalizar), los que hay que introducir con el plan de mejoras, y los reservados para la etapa storefront.

### A. Patrones ya presentes — mantener y nombrar explícitamente

Estos ya existen en el código. Documentarlos importa porque el siguiente desarrollador debe seguirlos por convención y no romperlos:

| Patrón | Dónde está hoy | Regla a mantener |
|--------|----------------|------------------|
| **Monolito modular** | `src/modules/*` (materiales, operarios, referencias, vales, pagos, ventas) | Un módulo = un agregado de negocio. La comunicación entre módulos es **siempre service → service** (como `PagosService` → `ProduccionService`), nunca repository de otro módulo ni query directa a tablas ajenas. |
| **Arquitectura en capas** | Controller → Service → Repository en todos los módulos | El controller no toca repositorios ni lógica de negocio; el service no conoce HTTP (no importa nada de `express` ni códigos de estado más allá de las excepciones de Nest); el repository no contiene reglas de negocio. |
| **Repository** | `*.repository.ts` envolviendo TypeORM | Toda query vive en el repository. Prohibido inyectar `Repository<T>` de TypeORM directo en services (excepción actual: `SeedService`, que se va con el ítem 3). |
| **DTO + validación declarativa** | `dto/*.dto.ts` con `class-validator`, `ValidationPipe` global con whitelist | Todo input HTTP pasa por un DTO. Nunca recibir entidades como body. |
| **Inyección de dependencias / IoC** | Constructor injection en todo el proyecto (NestJS) | Dependencias siempre por constructor; nada de `new` de services ni singletons manuales. |
| **Máquina de estados** | `ProduccionService.updateEstado` (`registrado → aprobado → pagado`) | Es el corazón del negocio. Al crecer, extraer las transiciones a una estructura declarativa (mapa `estadoActual → transicionesPermitidas` con su efecto) en lugar de la cadena if/else — más fácil de testear y de extender con nuevos estados. |
| **Unit of Work** | `registrarPagoTransaccional(pagoData, callback(manager))` en `PagosRepository` | Toda operación que toca dinero o múltiples agregados va dentro de una transacción con `EntityManager` propagado (los services ya aceptan `manager?` opcional — mantener esa firma). |
| **Exception Filter** (centralización de errores) | `HttpExceptionFilter` global | Un solo formato de error para toda la API (corregirlo según ítem 4, pero el patrón es correcto). |

### B. Patrones a introducir con el plan de mejoras

Cada uno está ligado a un ítem del plan — no son trabajo extra, son la *forma* de hacer ese trabajo:

| Patrón | Ítem del plan | Aplicación concreta |
|--------|---------------|---------------------|
| **Guard + Decorator** (autorización declarativa) | 1 | `JwtAuthGuard` y `RolesGuard` registrados como `APP_GUARD` globales; los endpoints declaran acceso con metadata: `@Public()`, `@Roles(Rol.ADMIN)`. La regla de seguridad se *lee* en el controller, no se esconde en lógica. **Default seguro: todo cerrado salvo lo marcado `@Public()`** (fail-closed). |
| **Strategy** | 1 | `passport-jwt` como estrategia de autenticación. Cuando llegue el storefront, se añade una segunda estrategia/audiencia sin tocar las existentes — ese es el punto del patrón. |
| **Mapper / Presenter** (DTO de respuesta por audiencia) | 13, storefront | Formalizar el `mapToFrontend` de `vales.controller.ts` como mappers tipados (`ValePresenter` o response DTOs con `class-transformer`). Regla: **las entidades nunca salen por HTTP**; cada audiencia (back-office, storefront futuro) tiene sus propios DTOs de respuesta. Esto es lo que evita fugas de datos internos (tarifas, costos) cuando exista API pública. |
| **Config tipada y validada al arranque** (fail-fast) | 8 | `registerAs` + `validationSchema` Joi en `ConfigModule`. Un solo lugar define el shape de la configuración; la app **no arranca** con config inválida. Eliminar lecturas dispersas de `process.env` (hoy en `app.module.ts` y `database.config.ts` duplicadas). |
| **Migraciones como evolución del esquema** | 2 | El esquema cambia solo por migraciones versionadas en el repo (nunca `synchronize`). Cada migración es inmutable una vez aplicada en cualquier entorno compartido. |
| **Bloqueo pesimista / verificación atómica** | 5, 6 | En operaciones de dinero y cupo: `SELECT ... FOR UPDATE` dentro de la transacción (TypeORM: `lock: { mode: 'pessimistic_write' }`), o `UPDATE ... WHERE estado = :esperado` verificando `affected`. Con 10 usuarios el pesimista es la opción simple y correcta; el optimista (columna `@VersionColumn`) se reserva para cuando haya contención real. |
| **Secuencias de BD para identidad** | 5 | El ID secuencial (`V-0001`) se genera con `SEQUENCE` de PostgreSQL, no leyendo el último registro. La BD es la única autoridad de identidad — esto es lo que permite múltiples instancias del backend (statelessness). |
| **Interceptor** (cross-cutting concerns) | 11 | Logging de request/response y métricas como `Interceptor` de Nest, no esparcido en services. Los services quedan limpios de preocupaciones transversales. |
| **Audit Trail (mínimo viable)** | 11 | No hace falta event sourcing: una tabla `auditoria` (quién, cuándo, acción, entidad, datos-antes/después) escrita **dentro de la misma transacción** para pagos, anulaciones y aprobaciones. Barato hoy, oro cuando el cliente pregunte "¿quién aprobó esto?". |
| **Seeder como comando** | 3 | El seed es un script CLI idempotente (`pnpm seed`), no un hook de arranque. El arranque de la app no muta datos — principio de menor sorpresa en producción. |
| **Health Check** | 11 | `@nestjs/terminus`: endpoint estándar que el proxy/monitoreo consulta. |

### C. Patrones reservados para la etapa storefront (no implementar aún)

Documentados para que la decisión ya esté tomada cuando llegue el momento:

- **Anti-Corruption Layer**: el módulo `storefront` traduce entre el dominio interno (referencias con tarifas y costos) y el modelo público (producto con precio y fotos). El storefront **nunca** importa entidades de producción; consume services internos y re-mapea. Así un cambio en producción no rompe la tienda y viceversa.
- **Facade**: un `CatalogoService` público como única puerta del storefront hacia el dominio interno, en lugar de que los controllers públicos llamen a N services internos.
- **Webhook + idempotencia** para la pasarela de pagos: los webhooks de confirmación de pago deben ser idempotentes (procesar dos veces la misma notificación no duplica el pedido) — clave de idempotencia = ID de transacción de la pasarela, con constraint único en BD.
- **Outbox / eventos de dominio**: solo si algún día hay que notificar sistemas externos (correo de confirmación, contabilidad) de forma confiable. Hasta entonces, llamadas directas dentro de la transacción bastan.
- **CQRS, Event Sourcing, Sagas**: explícitamente descartados. Son para dominios con alta concurrencia de escritura o necesidad de replay histórico; este negocio no los tiene y su costo de mantenimiento es alto. (El audit trail del grupo B cubre la necesidad real: trazabilidad.)

### Principios transversales (el criterio detrás de los patrones)

1. **Fail-fast**: config inválida → no arranca; transición de estado inválida → excepción inmediata. Los errores baratos son los que explotan temprano.
2. **Fail-closed**: sin token → 401 por defecto; lo público es la excepción marcada, nunca el default.
3. **La BD es la última línea de integridad**: constraints únicos, FKs con `RESTRICT` (ya se usa en `Vale.referencia` — bien) y checks respaldan lo que el código valida. El código puede tener bugs; el constraint no.
4. **Una sola fuente de verdad por dato**: el monto se congela en `montoPagado` al aprobar (ya implementado — correcto); los IDs los emite la BD; la config la emite `ConfigModule`.
5. **Dependencias apuntan hacia adentro**: HTTP/presentación depende del dominio, nunca al revés. Si mañana la API REST se acompaña de otra interfaz (jobs, CLI), los services no cambian.
6. **YAGNI con memoria**: lo que no se construye hoy queda documentado con su disparador ("cuando exista la landing → ACL + Facade"), para que la simplicidad de hoy no se confunda con falta de visión.

---

## Cumplimiento OWASP Top 10 (2021)

> Mapa de cada categoría contra las tareas del plan. Al completar las fases 1–4, el proyecto queda razonablemente cubierto para su contexto (app interna, 10 usuarios). Las brechas detectadas en esta revisión ya fueron incorporadas a las tareas correspondientes.

| # | Categoría | Cobertura en el plan | Estado |
|---|-----------|----------------------|--------|
| A01 | Broken Access Control | Guards globales fail-closed + roles (2.2); CORS restringido (2.3). Cuando entren los operarios: validar pertenencia (`operarioId` del JWT vs. registro) — ya previsto en el diseño 1.1. | ✅ con el plan |
| A02 | Cryptographic Failures | `bcrypt` para contraseñas (2.2); `JWT_SECRET` ≥ 32 chars validado por Joi (2.2); **TLS obligatorio** vía reverse proxy en producción (4.6); sin datos de tarjetas (los pagos online futuros van por pasarela externa). | ✅ con el plan |
| A03 | Injection | TypeORM con queries parametrizadas; `ValidationPipe` whitelist + DTOs estrictos; regla del implementador: **prohibido SQL crudo con interpolación de strings**. XSS: React escapa por defecto; regla: prohibido `dangerouslySetInnerHTML`. | ✅ ya / con reglas |
| A04 | Insecure Design | Máquina de estados con transiciones explícitas; montos congelados al aprobar; pago solo vía transacción; fail-closed por defecto; validaciones atómicas (1.5). | ✅ ya / fase 1 |
| A05 | Security Misconfiguration | `helmet` (2.3); filtro de errores sin fuga de internals (2.1); `synchronize: false` (1.2); Swagger deshabilitado/protegido en producción (4.3); config fail-fast sin defaults inseguros (1.1); Postgres no expuesto (4.6). | ✅ con el plan |
| A06 | Vulnerable Components | `pnpm audit` en CI con umbral (3.4) + Dependabot (3.4); lockfile versionado. | ✅ con el plan |
| A07 | Auth Failures | Login con rate limit 5/min (2.3); expiración de token 8h (2.2); contraseña admin por env, nunca hardcodeada; **cambio de contraseña** y longitud mínima (2.2); intentos de login registrados (4.1/4.2). Sin revocación de tokens (logout solo borra el token del cliente): aceptado a esta escala con vida de 8h — si se vuelve requisito, añadir lista de denegación. MFA: no requerido para app interna; ofrecerlo al cliente como opción. | ✅ con el plan (excepciones documentadas) |
| A08 | Software/Data Integrity | CI obligatorio antes de merge (3.4); migraciones revisadas a mano e inmutables (1.2); lockfile estricto; sin fuentes de paquetes no confiables. | ✅ con el plan |
| A09 | Logging & Monitoring | Logging estructurado por request (4.1); audit trail transaccional de dinero y aprobaciones (4.2); **logins fallidos y exitosos en el log/auditoría** (4.1); health check (4.4). Sin alertas automáticas: aceptable hoy; documentar al cliente cómo revisar logs. | ✅ con el plan |
| A10 | SSRF | N/A: el backend no hace requests salientes con input del usuario. **Disparador**: revisar cuando se integren webhooks de pasarela de pagos (etapa storefront) — validar origen/firma de webhooks ahí. | ✅ N/A hoy, documentado |

**Resumen honesto**: nada del Top 10 queda descubierto al terminar la fase 4. Las concesiones conscientes (sin revocación de JWT, sin MFA, sin alertas de monitoreo) son proporcionales a una app interna de 10 usuarios y están documentadas con su condición de revisión. La categoría que exige disciplina continua es A06: el `audit` en CI y Dependabot solo sirven si alguien atiende sus avisos — dejarlo acordado con el cliente como parte del mantenimiento.

---

## Guía de implementación (plan ejecutable)

> **Cada tarea de esta guía existe también como archivo autocontenido en [`docs/tareas/`](tareas/README.md)** — esa carpeta es la forma recomendada de ejecutar el plan con una IA: un archivo por tarea, con contexto, pasos, criterio de aceptación y mensaje de commit sugerido. El índice y las reglas del implementador están en [tareas/README.md](tareas/README.md).

> Orden de fases y por qué: la **fase 1** va primero porque tocar `synchronize`/migraciones cambia el flujo de desarrollo de todo lo demás, y los bugs de concurrencia/seed dañan datos reales aunque ya hubiera login. Resumen: 1) Integridad de datos → 2) Seguridad perimetral → 3) Tests y CI → 4) Operabilidad → 5) Pulido.

### Reglas para el implementador (humano o IA) — leer antes de cualquier tarea

1. **Una tarea por vez, en orden.** No mezclar tareas en un mismo commit. Formato de commit: `feat(scope): descripción` / `fix(scope): ...` / `test(scope): ...`.
2. **Respetar las convenciones de la sección "Patrones" grupo A**: comunicación entre módulos solo service→service; queries solo en repositories; todo input HTTP por DTO con `class-validator`; mensajes de error y de validación **en español**, como los existentes.
3. **No romper el contrato actual del frontend** (`e:\proyectos\control-produccion\src\services\api.js` define todas las llamadas y shapes esperados). Si una tarea cambia rutas o shapes (p. ej. prefijo `/api/v1`), la misma tarea actualiza el frontend.
4. **Definition of Done de toda tarea**: `pnpm build` y `pnpm lint` pasan sin errores; los tests existentes pasan (`pnpm test`); el criterio de aceptación de la tarea se verificó manualmente o con test; checkbox marcado en este documento.
5. **Nunca**: reintroducir `synchronize: true`; exponer entidades TypeORM en respuestas HTTP nuevas; guardar secretos en el repo; usar `any` en código nuevo; escribir SQL crudo con interpolación de strings (siempre parámetros, incluso en `query()` manual); usar `dangerouslySetInnerHTML` en el frontend.
6. Base de datos local: `compose.yaml` levanta PostgreSQL (`docker compose up -d`). Backend corre con `pnpm start:dev` en puerto 3001; frontend con `pnpm dev` en puerto 3000.

---

### FASE 0 — Preparación (15 min)

#### Tarea 0.1 — Línea base
- **Hacer**: crear rama `mejoras/fase-1`; verificar que `pnpm build` y `pnpm start:dev` funcionan; crear `.env.example` en la raíz del backend con todas las variables actuales (`DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`, `DATABASE_DATABASE`, `PORT`) con valores de ejemplo, y versionarlo.
- **Aceptación**: `.env.example` en git; la app arranca y responde `GET /vales`.

---

### FASE 1 — Integridad de datos

#### Tarea 1.1 — Configuración única, tipada y validada (ítem 8)
- **Archivos**: `src/config/database.config.ts`, `src/app.module.ts`, nuevo `src/config/env.validation.ts`.
- **Hacer**:
  1. Instalar `joi`.
  2. Crear esquema Joi que exija `DATABASE_HOST`, `DATABASE_PORT` (número), `DATABASE_USERNAME`, `DATABASE_PASSWORD`, `DATABASE_DATABASE`, `PORT` (número, default 3001), `NODE_ENV` (`development`|`production`|`test`, default `development`). Pasarlo a `ConfigModule.forRoot({ isGlobal: true, validationSchema })`.
  3. `TypeOrmModule.forRootAsync` leyendo de `ConfigService` (un solo lugar de config). **Eliminar todos los fallbacks** `|| 'postgres'` y el `=== 'true' || true` bugueado de `database.config.ts`.
  4. Añadir al `.env.example` las variables nuevas a medida que aparezcan en fases siguientes (`JWT_SECRET`, `CORS_ORIGIN`, etc.).
- **Aceptación**: renombrar `.env` temporalmente → la app **no arranca** y el error dice qué variable falta. Con `.env` presente arranca normal.

#### Tarea 1.2 — Migraciones TypeORM y fin de `synchronize` (ítem 2)
- **Archivos**: nuevo `src/config/data-source.ts` (DataSource para CLI), `src/app.module.ts`, `package.json`, carpeta nueva `src/migrations/`.
- **Hacer**:
  1. Crear `data-source.ts` exportando un `DataSource` que lea `.env` (dotenv), apunte `entities` a `src/**/*.entity.ts` y `migrations` a `src/migrations/*.ts`.
  2. Scripts en `package.json`: `migration:generate`, `migration:run`, `migration:revert` (usando `typeorm-ts-node-commonjs -d src/config/data-source.ts`).
  3. Con la BD actual ya sincronizada, generar la **migración inicial** (`pnpm migration:generate src/migrations/InitialSchema`). Revisarla a mano: debe crear todas las tablas (`materiales`, `referencias`, `tarifas`, `receta_items`, `operarios`, `vales`, `vale_tallas`, `produccion_regs`, `pagos`, `ventas` — verificar nombres reales en las entidades).
  4. Poner `synchronize: false` (sin condición) y `migrationsRun: false` en el módulo; documentar en README que el flujo es: cambiar entidad → `migration:generate` → revisar → `migration:run`.
  5. Probar contra una BD vacía: `docker compose down -v && docker compose up -d`, luego `pnpm migration:run` → el esquema completo se crea.
- **Aceptación**: BD recreada desde cero solo con migraciones; la app arranca con `synchronize: false` y `GET /vales` responde.

#### Tarea 1.3 — Seed como comando manual (ítem 3)
- **Archivos**: `src/services/seed.service.ts` → mover a `src/seed/` como script; `src/app.module.ts`; `package.json`.
- **Hacer**:
  1. Quitar `OnModuleInit` y sacar `SeedService` (y el `TypeOrmModule.forFeature` que lo alimenta) de `AppModule`.
  2. Crear `src/seed/seed.ts`: script standalone que crea un contexto Nest (`NestFactory.createApplicationContext`) con un `SeedModule` propio, ejecuta el seed (idempotente: si hay datos, no hace nada y lo dice) y cierra.
  3. Script `"seed": "ts-node -r tsconfig-paths/register src/seed/seed.ts"` en `package.json`.
- **Aceptación**: la app arranca sin sembrar nada; `pnpm seed` puebla una BD vacía y, ejecutado de nuevo, no duplica.

#### Tarea 1.4 — IDs por secuencia de PostgreSQL (ítem 5)
- **Archivos**: nueva migración, `src/modules/vales/vales.repository.ts` + `vales.service.ts`, `src/modules/ventas/ventas.repository.ts` + `ventas.service.ts`, `src/modules/pagos/pagos.service.ts`.
- **Hacer**:
  1. Migración: `CREATE SEQUENCE vales_seq; CREATE SEQUENCE ventas_seq; CREATE SEQUENCE pagos_seq;` e inicializarlas con `setval` al máximo actual (extraer el número de los IDs existentes, p. ej. `MAX(substring(vale from 3)::int)`).
  2. En los repositories, método `nextId()` que haga `SELECT nextval('vales_seq')` **con el `EntityManager` de la transacción activa** y formatee (`V-` + padStart(4)). Eliminar `findLast()` y el parseo de IDs en los services (incluido el `parseInt` sin guardia de `vales.service.ts:44`).
  3. Pagos: reemplazar `PG-${Date.now()}-...` por `PG-` + secuencia.
  4. La creación del vale (`crearConRelaciones`) debe obtener el ID dentro de la misma transacción que inserta.
- **Aceptación**: test (o script) que dispara 10 `POST /vales` en paralelo (`Promise.all`) → 10 vales creados con IDs únicos consecutivos, cero errores de PK.

#### Tarea 1.5 — Operaciones de negocio atómicas (ítem 6)
- **Archivos**: `src/modules/vales/produccion.service.ts`, `produccion.repository.ts`, `src/modules/pagos/pagos.service.ts`, `pagos.repository.ts`.
- **Hacer**:
  1. `registerProduccion`: envolver validación de cupo + insert en una transacción que bloquee el vale (`pessimistic_write` sobre la fila del vale) antes de sumar pares; así dos registros simultáneos no superan el cupo.
  2. `updateEstado`: persistir con `UPDATE ... SET estado = :nuevo, "montoPagado" = :monto WHERE id = :id AND estado = :estadoActual` y verificar `affected === 1`; si es 0, lanzar `ConflictException` («el registro fue modificado por otra operación, recargue e intente de nuevo»).
  3. `pagarLote` y `pagar`: mover la validación de estados **dentro** de la transacción, releyendo los registros con lock pesimista antes de crear pagos y cambiar estados.
- **Aceptación**: tests de concurrencia: (a) dos registros simultáneos que sumados exceden el cupo → uno falla con 400; (b) dos `pagar` simultáneos del mismo registro → exactamente un pago creado.

---

### FASE 2 — Seguridad perimetral

#### Tarea 2.1 — Filtro de excepciones seguro (ítem 4)
- **Archivos**: `src/common/filters/http-exception.filter.ts`.
- **Hacer**: `HttpException` → responder su status y mensaje (conservar el formato actual de respuesta: `statusCode`, `timestamp`, `path`, `message`, `details`). Cualquier otro error → **500** con `message: 'Error interno del servidor'`, registrando con `Logger.error` el mensaje real y stack. Eliminar el mapeo `Error → 400`.
- **Atención**: los services ya usan excepciones Nest (`BadRequestException`, etc.), así que ningún flujo de negocio depende del mapeo viejo; verificarlo con grep de `throw new Error` en `src/` (si aparece alguno en lógica de negocio, convertirlo a la excepción Nest correcta en esta misma tarea).
- **Aceptación**: forzar un error de BD (p. ej. FK inexistente vía SQL directo) → respuesta 500 genérica sin nombres de tablas/columnas; un 404 de negocio sigue mostrando su mensaje en español.

#### Tarea 2.2 — Módulo de autenticación JWT (ítems 1 y 1.1)
- **Archivos**: nuevo módulo `src/modules/auth/` (entity, service, controller, strategy, guards, decoradores), migración para tabla `usuarios`, `src/app.module.ts`.
- **Hacer** (seguir el diseño completo de la sección 1.1):
  1. Instalar `@nestjs/jwt @nestjs/passport passport passport-jwt bcrypt` (+ types).
  2. Entidad `Usuario`: `id` (uuid), `username` (único), `passwordHash`, `rol` enum (`ADMIN`|`OPERARIO`), `operarioId` nullable FK a `operarios`, `activo` boolean default true. Migración correspondiente.
  3. `POST /auth/login` (público): valida credenciales con `bcrypt.compare`, responde `{ accessToken, usuario: { username, rol } }`. Claims del JWT: `sub`, `username`, `rol`, `operarioId`. Expiración por env `JWT_EXPIRES_IN` (default `8h`); secreto por env `JWT_SECRET` (añadir a validación Joi: requerido, mínimo 32 chars; y a `.env.example`).
  4. `JwtAuthGuard` y `RolesGuard` registrados como `APP_GUARD` globales (**fail-closed**). Decoradores `@Public()` y `@Roles(Rol.ADMIN)`.
  5. Marcar **todos** los controllers existentes con `@Roles(Rol.ADMIN)` (el operario llegará después); solo `/auth/login` y `/health` (fase 4) son `@Public()`.
  6. Script `pnpm create-admin` (mismo patrón que el seed): crea el usuario admin leyendo `ADMIN_USERNAME`/`ADMIN_PASSWORD` del env; falla si ya existe.
  7. `PATCH /auth/password` (autenticado, cualquier rol): exige contraseña actual + nueva; política mínima validada en DTO: 10+ caracteres (rechazar también que sea igual al username). Aplicar la misma política en `create-admin`.
  8. Registrar con `Logger.warn` cada login fallido (username e IP) y con `Logger.log` cada login exitoso — base para la auditoría de la fase 4 (OWASP A07/A09).
- **Aceptación**: sin token, `GET /vales` → 401; con token de login válido → 200; token expirado/alterado → 401; cambio de contraseña funciona y la anterior deja de servir; los intentos fallidos quedan en el log.

#### Tarea 2.3 — Endurecimiento HTTP + versionado (ítems 7 y visión `/api/v1`)
- **Archivos**: `src/main.ts`, `src/app.module.ts`, frontend `src/services/api.js`.
- **Hacer**:
  1. Instalar `helmet` y `@nestjs/throttler`.
  2. `app.setGlobalPrefix('api/v1')`; `app.use(helmet())`; `json({ limit: '1mb' })`.
  3. CORS: `app.enableCors({ origin: configService.get('CORS_ORIGIN').split(',') })` — variable requerida en Joi y `.env.example` (dev: `http://localhost:3000`).
  4. `ThrottlerModule` global (p. ej. 100 req/min) + límite estricto en `POST /auth/login` (`@Throttle`: 5 intentos/min).
  5. **Misma tarea, frontend**: `API_URL` pasa a `import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api/v1'`; crear `.env.example` del frontend con `VITE_API_URL`.
- **Aceptación**: rutas viejas sin prefijo → 404; desde origen no listado el navegador bloquea por CORS; 6º intento de login en un minuto → 429; el frontend sigue funcionando completo contra `/api/v1`.

#### Tarea 2.4 — Login en el frontend
- **Archivos**: frontend — `src/services/api.js`, `src/App.jsx`, nueva vista `src/views/LoginView.jsx`, `src/hooks/useControlProduccion.js`.
- **Hacer**:
  1. `api.js`: función `login(username, password)`; guardar token en memoria + `sessionStorage`; añadir `Authorization: Bearer` a `request()`; ante 401, limpiar token y redirigir a login. Parsear el error JSON del backend y lanzar `message` legible (no el body crudo).
  2. `LoginView` simple (estilo consistente con las vistas existentes); `App.jsx` muestra login si no hay sesión.
- **Aceptación**: flujo completo en navegador: login → operar vales/pagos → al expirar o borrar el token, vuelve a login sin quedar en estado roto.

---

### FASE 3 — Red de seguridad (tests y CI)

#### Tarea 3.1 — Validación estricta de `tallas` (ítem 10)
- **Archivos**: `src/modules/vales/dto/create-vale.dto.ts`, `src/modules/vales/vales.controller.ts`.
- **Hacer**: validador custom (o transformación a array anidado con `@ValidateNested`) que exija: claves numéricas enteras (tallas razonables, p. ej. 15–60), valores enteros positivos, objeto no vacío. Mensajes en español.
- **Aceptación**: `POST /vales` con `{"tallas": {"abc": -1}}` → 400 con mensaje claro; payload válido sigue funcionando.

#### Tarea 3.2 — Unit tests de la lógica de negocio (ítem 9)
- **Archivos**: nuevos `*.spec.ts` junto a cada service (`produccion.service.spec.ts`, `pagos.service.spec.ts`, `vales.service.spec.ts`, `ventas.service.spec.ts`).
- **Hacer**: con repositories mockeados, cubrir como mínimo: **todas** las transiciones de `updateEstado` (válidas: registrado→aprobado congela monto = pares × tarifa; aprobado→registrado vuelve monto a 0; aprobado→pagado y pagado→aprobado solo con manager; inválidas: el resto → 400); cupo de `registerProduccion` (exacto al límite pasa, +1 falla); `pagar` rechaza estados ≠ aprobado; `pagarLote` rechaza inconsistencias vale/etapa; `deleteRegistro` rechaza pagados.
- **Aceptación**: `pnpm test` verde; cobertura de `produccion.service.ts` y `pagos.service.ts` ≥ 80% líneas (`pnpm test:cov`).

#### Tarea 3.3 — Test e2e del flujo completo (ítem 9)
- **Archivos**: `test/app.e2e-spec.ts` (reescribir), `test/jest-e2e.json`.
- **Hacer**: contra una BD de test (base `control_produccion_test`, migraciones corridas en `beforeAll`): login admin → crear vale → registrar producción → aprobar → pagar → verificar pago creado y estado `pagado` → anular → verificar estado `aprobado`. Incluir un caso 401 sin token.
- **Aceptación**: `pnpm test:e2e` verde y repetible (limpia sus datos o recrea esquema por corrida).

#### Tarea 3.4 — CI (ítem 16)
- **Archivos**: nuevo `.github/workflows/ci.yml`.
- **Hacer**: workflow en push/PR: pnpm install → lint → build → test (unit) → `pnpm audit --audit-level=high` (falla el pipeline con vulnerabilidades altas/críticas). Job de e2e con service container de Postgres 15. Añadir `.github/dependabot.yml` (npm, semanal, ambos proyectos si aplica). Job equivalente para el frontend (install + build + audit) — nota: el frontend es repo separado; si no se monorepea, crear su propio workflow allí.
- **Aceptación**: pipeline verde en GitHub sobre la rama de trabajo; Dependabot activo.

---

### FASE 4 — Operabilidad

#### Tarea 4.1 — Logging estructurado (ítem 11)
- **Hacer**: reemplazar todo `console.log` por `Logger` de Nest con contexto; `LoggingInterceptor` global (método, ruta, status, ms, username del JWT si existe). Log explícito en operaciones de dinero: pago creado/anulado con regId, monto, usuario.
- **Aceptación**: cada request deja una línea de log; un pago deja rastro identificable.

#### Tarea 4.2 — Auditoría mínima (ítem 11 / patrón Audit Trail)
- **Hacer**: entidad + migración `auditoria` (`id`, `fecha`, `usuario`, `accion`, `entidad`, `entidadId`, `detalle` jsonb). Registrar **dentro de la misma transacción**: pagar, anular pago, aprobar/revertir producción, eliminar registro. Endpoint `GET /api/v1/auditoria` solo ADMIN, paginado.
- **Aceptación**: tras pagar y anular, la tabla contiene ambas filas con el usuario correcto.

#### Tarea 4.3 — Swagger (ítem 12)
- **Hacer**: `@nestjs/swagger` en `/api/docs` (protegido o deshabilitado en producción vía env), decorar DTOs y endpoints, incluir auth Bearer en la UI.
- **Aceptación**: `/api/docs` permite autenticarse y ejecutar `GET /vales` desde la UI.

#### Tarea 4.4 — Health check (ítem 11)
- **Hacer**: `@nestjs/terminus`, `GET /api/v1/health` público con ping a PostgreSQL.
- **Aceptación**: con BD arriba → 200; con BD caída → 503.

#### Tarea 4.5 — Paginación (ítem 14)
- **Hacer**: DTO común `PaginationQueryDto` (`page` default 1, `limit` default 50 máx 200, opcional `desde`/`hasta` por fecha); aplicarlo a `GET /vales`, `GET /pagos`, `GET /ventas` con respuesta `{ data, total, page, limit }`. **Actualizar el frontend** (`api.js` y las vistas que consumen estas listas) en la misma tarea.
- **Aceptación**: listas grandes responden paginadas; el frontend muestra los datos correctamente.

#### Tarea 4.6 — Despliegue reproducible (ítem 15)
- **Hacer**: `Dockerfile` multi-stage del backend (deps → build → runtime `node:22-alpine` con usuario no root, `CMD ["node", "dist/main"]`); extender `compose.yaml` con el servicio backend (lee env de `.env`, `depends_on` db con healthcheck) y quitar la exposición del 5432 (o `127.0.0.1:5432:5432`); credenciales de Postgres desde `.env`. **TLS obligatorio en producción** (no opcional): reverse proxy (Caddy recomendado por TLS automático con Let's Encrypt, o nginx + certbot) como único punto expuesto, terminando HTTPS y enrutando al backend y al frontend estático; el backend nunca se expone directo. README: sección "Despliegue" con pasos exactos (env → `docker compose up` → `migration:run` → `create-admin`) y estrategia de backup (`pg_dump` programado).
- **Aceptación**: en una máquina limpia con Docker: clonar → configurar `.env` → compose up → migraciones → create-admin → frontend conecta y opera.

---

### FASE 5 — Pulido

#### Tarea 5.1 — Mappers tipados y fin de los `any` (ítem 13)
- **Hacer**: tipar `mapToFrontend` como mapper/presenter formal con interfaces de respuesta; eliminar `as any` del seed creando los objetos anidados con tipos correctos; tipar el filtro de excepciones; revisar `tsconfig.json` y activar las strict flags que falten, corrigiendo lo que destape.
- **Aceptación**: `grep -r "any" src/` sin `any` injustificados; build estricto verde.

#### Tarea 5.2 — Consistencia de dominio (ítem 13)
- **Hacer**: `Pago.etapa` al enum `Oficio` (con migración si el tipo de columna cambia); columnas `fecha` a tipo `date` con `@IsDateString()` en DTOs (migración); verificar que **toda** columna de dinero use `numeric` + `decimal.transformer`.
- **Aceptación**: migraciones corren sobre datos existentes sin pérdida; fechas inválidas rechazadas con 400.

#### Tarea 5.3 — Higiene de frontend y repos (ítems 17, 18)
- **Hacer**: ESLint en el frontend (config para React) + script `lint`; completar `description`/`author`/licencia en ambos `package.json`; `pnpm audit` en ambos proyectos y resolver lo crítico; verificar la versión de `typeorm` declarada; README de arquitectura breve (módulos y flujo vale→producción→pago→venta).
- **Aceptación**: lint verde en ambos proyectos; `pnpm audit` sin vulnerabilidades altas/críticas pendientes sin justificar.

---

### Tablero de avance

| Fase | Tareas | Estado |
|------|--------|--------|
| 0. Preparación | 0.1 | ✅ |
| 1. Integridad de datos | 1.1 · 1.2 · 1.3 · 1.4 · 1.5 | ✅ |
| 2. Seguridad perimetral | 2.1 · 2.2 · 2.3 · 2.4 | ⬜ |
| 3. Tests y CI | 3.1 · 3.2 · 3.3 · 3.4 | ⬜ |
| 4. Operabilidad | 4.1 · 4.2 · 4.3 · 4.4 · 4.5 · 4.6 | ⬜ |
| 5. Pulido | 5.1 · 5.2 · 5.3 | ⬜ |
| 6. Funcionalidades | 6.1 + F6 (imagen del modelo) · 6.2 + F9 (revisión de calidad con rechazos) | ⬜ |

**Hito de entrega al cliente: fin de la fase 4 + fase 6, seguido de una sesión de UAT** (prueba de aceptación): antes de dar por entregado, el administrador real opera el flujo completo — crear modelo con foto, vale, anotar, revisar con rechazo, pagar, anular, venta — con sus datos reales y en su celular y PC. Los datos reales (operarios, materiales, modelos con tarifas) se cargan por la pantalla de Ajustes en esa misma sesión; no hay migración de datos previa que preparar. La fase 5 puede hacerse post-entrega. Los patrones del grupo C (storefront) **no** se implementan en este plan — quedan documentados para cuando la landing sea real.

---

## Decisiones pendientes del cliente (bloquean tareas concretas)

Nada de esto lo puede decidir el implementador; conviene resolverlas antes de llegar a la tarea que las necesita:

| # | Decisión | Bloquea | Notas |
|---|----------|---------|-------|
| 1 | **Dónde se hospeda**: VPS en la nube (Hetzner/DigitalOcean/Contabo, ~5–10 USD/mes) o un equipo en el taller. | 4.6 | Recomendación: VPS — el celular del admin funciona fuera del taller, backups más fáciles, sin depender del PC local encendido. |
| 2 | **Dominio** (p. ej. `app.scalaleather.com`) para el TLS de Caddy. | 4.6, 2.3 (`CORS_ORIGIN` real) | Costo ~12 USD/año. Si es red local pura, decidir cómo se maneja el certificado. |
| 3 | **Username y correo del administrador** + política de quién más tendrá cuenta a corto plazo. | 2.2 (`create-admin`) | |
| 4 | **Licencia/propiedad del código** acordada en el contrato. | 5.3 | Hoy `UNLICENSED`. |

## Backlog post-entrega (documentado con disparador, no se implementa ahora)

| Candidato | Disparador para hacerlo | Esfuerzo |
|-----------|------------------------|----------|
| **Desactivar operarios/materiales/modelos** (soft-delete con flag `activo`): hoy no se puede retirar del catálogo a un operario que se fue sin romper su historial (las FK lo impiden, correctamente). | La primera vez que un operario deje el taller o un material se descontinúe. | Medio (flag + filtro en selects del front) |
| **Exportar a Excel/CSV** el historial de pagos y ventas. | Cuando el contador lo pida (lo pedirá). | Bajo (CSV desde el front con los datos ya cargados) |
| **PWA instalable** (manifest + ícono): "Agregar a pantalla de inicio" en el celular del admin, pantalla completa sin barra del navegador. | Si el admin usa principalmente el celular. | Bajo |
| **Fuentes autoalojadas**: hoy las tipografías cargan de Google Fonts — si el internet del taller falla, la app abre con fuentes de respaldo. | Si la conectividad del taller es inestable. | Bajo |
| Rol OPERARIO activo (login para operarios, registrar su propia producción) | Decisión del negocio — el diseño ya lo soporta (sección 1.1). | Medio |
| Landing/storefront | Decisión del negocio — ver visión arquitectónica y patrones grupo C. | Alto |

### FASE 6 — Funcionalidades pedidas por el cliente

#### Tarea 6.1 — Imagen del modelo (referencia) con foto desde el celular
- **Qué**: cada referencia puede tener una foto del zapato, subida al crear/editar el modelo (en móvil, tomada con la cámara), visible en los vales para identificar el producto. Detalle completo: [tareas/6.1-imagen-referencia.md](tareas/6.1-imagen-referencia.md) (backend) y `control-produccion/docs/tareas/F6-imagen-referencia.md` (frontend).
- **Decisiones de arquitectura**: almacenamiento en disco local con volumen (no S3 a esta escala; disparador: múltiples instancias → object storage); una imagen por referencia, re-subir reemplaza; GET público (fotos no sensibles, los `<img>` no envían Authorization), POST/DELETE solo ADMIN; upload con whitelist de tipos (jpeg/png/webp), 5 MB máximo y nombre de archivo generado por el servidor — nunca el del cliente (OWASP A03/A05).
- **Frontend**: `<input type="file" accept="image/*">` nativo — en móvil el navegador ofrece cámara o galería sin librerías; preview local, fallback a placeholder donde no haya foto.
- **Nota futura**: cuando exista la landing/storefront, estas mismas imágenes alimentan el catálogo público (la decisión de modelado ya estaba prevista en la visión arquitectónica: "Referencia gana campos de publicación... imágenes").

#### Tarea 6.2 — Revisión de calidad con aprobación parcial y rechazos
- **Qué**: "Revisar OK" deja de ser todo-o-nada — se aprueban N de M pares; los rechazados se archivan con motivo en una tabla `rechazos` (reportes de segundas por etapa/operario/modelo) y liberan cupo para reproceso. Junto con esto, **el dinero queda con una sola puerta**: el botón "Pagar" (y "Deshacer pago") sale del vale; pagar y anular viven solo en la pestaña Pagos, consolidado por operario. Detalle: [tareas/6.2-revision-calidad.md](tareas/6.2-revision-calidad.md) (backend) y `control-produccion/docs/tareas/F9-revision-calidad-flujo-pago.md` (frontend).
- **Decisiones**: endpoint propio `POST .../revision` (la transición HTTP a `aprobado` vía PATCH se bloquea — una puerta por concepto; el `updateEstado` interno del módulo de pagos no cambia); los rechazos no son un estado nuevo de la máquina sino un descuento del registro + archivo histórico; deshacer una aprobación no resucita rechazos. Trazabilidad: `revisadoPor`/`revisadoEn` en el registro, visible en el frontend.

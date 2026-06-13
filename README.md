# Control Producción — Backend

Backend NestJS para el sistema de control de producción y pagos de operarios.

## Requisitos

- Node.js 20+
- pnpm
- Docker (para la base de datos local)

## Instalación

```bash
# 1. Clonar e instalar dependencias
pnpm install

# 2. Copiar el archivo de variables de entorno y completarlo
cp .env.example .env
# Editar .env con los valores reales (nunca commitear .env)

# 3. Levantar la base de datos local
docker compose up -d

# 4. Ejecutar las migraciones para crear el esquema
pnpm migration:run

# 5. (Opcional) Poblar con datos de demostración
pnpm seed
```

## Comandos de desarrollo

```bash
pnpm start:dev      # Servidor en modo watch (puerto 3001)
pnpm build          # Compilar TypeScript
pnpm lint           # Lint + autofix
pnpm test           # Unit tests
pnpm test:e2e       # Tests end-to-end
```

## Migraciones de base de datos

> **Regla cardinal**: el esquema evoluciona **solo** por migraciones. `synchronize` está
> deshabilitado permanentemente. Una migración aplicada en cualquier entorno compartido
> es inmutable — los cambios van en una migración nueva.

```bash
# Flujo para cambiar el esquema:
# 1. Modificar la entidad TypeORM (.entity.ts)
# 2. Generar la migración (compara entidades vs BD actual)
pnpm migration:generate src/migrations/NombreDescriptivo

# 3. Revisar el SQL generado en src/migrations/ antes de aplicar
# 4. Aplicar la migración
pnpm migration:run

# Revertir la última migración aplicada
pnpm migration:revert
```

## Variables de entorno

Ver `.env.example` para la lista completa. Las variables requeridas son:

| Variable | Descripción |
|----------|-------------|
| `DATABASE_HOST` | Host de PostgreSQL |
| `DATABASE_PORT` | Puerto (normalmente 5432) |
| `DATABASE_USERNAME` | Usuario de la BD |
| `DATABASE_PASSWORD` | Contraseña de la BD |
| `DATABASE_DATABASE` | Nombre de la base de datos |
| `PORT` | Puerto del servidor (default: 3001) |
| `NODE_ENV` | `development` \| `production` \| `test` |

La app **no arranca** si alguna variable requerida falta (fail-fast con Joi).

## Despliegue en producción

El stack se levanta con Docker Compose: **PostgreSQL + backend + Caddy** (reverse proxy con HTTPS automático). Caddy es el único servicio expuesto a internet (puertos 80/443); el backend y la BD quedan en la red interna.

### Requisitos previos
- Un servidor con Docker y Docker Compose.
- Los **dos repos** clonados como hermanos (Caddy construye el frontend desde `../control-produccion`):
  ```
  proyectos/
  ├── Control_produccion_back/   # este repo (aquí vive compose.yaml)
  └── control-produccion/        # frontend
  ```
- Un **dominio** apuntando al servidor (necesario para el certificado TLS de Let's Encrypt).

### Pasos

```bash
# 1. Configurar el entorno (credenciales fuertes, dominio real)
cp .env.example .env
#   En .env, para producción:
#     DATABASE_PASSWORD=<contraseña fuerte>
#     JWT_SECRET=<aleatorio de 48+ chars: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))">
#     CORS_ORIGIN=https://app.tudominio.com
#     CADDY_SITE_ADDRESS=app.tudominio.com
#     NODE_ENV=production
#     ADMIN_USERNAME / ADMIN_PASSWORD (para crear el admin inicial)

# 2. Construir y levantar el stack
docker compose up -d --build

# 3. Crear el esquema (migraciones, desde los artefactos compilados)
docker compose exec backend pnpm migration:run:prod

# 4. Crear el usuario administrador inicial
docker compose exec backend pnpm create-admin:prod

# 5. Verificar salud
curl https://app.tudominio.com/api/v1/health     # → {"status":"ok",...}
```

Caddy obtiene y renueva el certificado TLS automáticamente. Para una **prueba local** del stack, dejar `CADDY_SITE_ADDRESS=localhost` (genera un certificado autofirmado) y usar `curl -k https://localhost/...`.

**Desarrollo** (backend en el host con hot-reload): levantar solo la BD con `docker compose up -d db`.

### Backups de la base de datos

```bash
# Backup manual
docker compose exec db pg_dump -U <usuario> <base> > backup-$(date +%F).sql

# Restaurar en una base nueva
docker compose exec -T db psql -U <usuario> -d <base_nueva> < backup-AAAA-MM-DD.sql
```

**Recomendación**: backup diario automatizado con `cron` (`pg_dump` a un directorio versionado o almacenamiento externo), reteniendo **14 diarios + 1 mensual**. Probar la restauración periódicamente — un backup no verificado no es un backup.

## Arquitectura

Monolito modular: `controller → service → repository` por módulo de negocio.

```
src/
├── config/           # Validación de env (Joi), DataSource para CLI
├── common/           # Filtros globales, guards, interceptors, utils, transformers
├── modules/
│   ├── auth/         # JWT, roles (ADMIN/OPERARIO), guards fail-closed
│   ├── materiales/
│   ├── operarios/
│   ├── referencias/  # Modelos: tarifas por oficio, receta, foto del modelo
│   ├── vales/        # Core: vales, produccion_registros, rechazos, vale_tallas
│   ├── pagos/        # Nómina de operarios (no cobros a clientes)
│   ├── ventas/
│   ├── auditoria/    # Rastro transaccional de dinero y aprobaciones
│   └── health/       # Health check (terminus)
├── seed/             # Scripts: seed de demo y create-admin
└── migrations/       # Migraciones TypeORM versionadas
```

**Convenciones obligatorias:**
- Comunicación entre módulos: siempre `service → service`, nunca repository cruzado.
- Queries: solo en `*.repository.ts`. Prohibido inyectar `Repository<T>` de TypeORM directo en services.
- Todo input HTTP pasa por DTO con `class-validator`. Las entidades nunca se exponen en respuestas HTTP directamente.
- Mensajes de error y validación en español.

### Flujo de negocio

```
Referencia (modelo) ──► Vale (orden de producción: modelo + tallas)
                              │
                              ▼
        Registro de producción por operario y etapa
        (Cortador → Guarnecedor → Solador → Finizaje)
                              │
                              ▼
        Revisión de calidad (aprobación parcial + rechazos)
                              │
                              ▼
        Pago de mano de obra al operario (monto congelado)
                              │
   Vale terminado (Finizaje) ─┴─► Venta del calzado en stock
```

### Máquina de estados de producción

Cada registro de producción transita por estados controlados; el monto se
**congela** al aprobar (pares × tarifa del momento) y se paga ese valor:

```
registrado ──(revisión: aprobar N pares)──► aprobado ──(módulo pagos)──► pagado
    ▲                                          │  ▲                          │
    └──────────(deshacer, monto→0)─────────────┘  └──(anular pago)───────────┘
```

- La aprobación es **solo** vía el endpoint de revisión (`POST .../revision`), no por PATCH directo.
- `aprobado → pagado` y `pagado → aprobado` solo ocurren dentro de transacciones del módulo de pagos.
- Las transiciones inválidas se rechazan con 400; los conflictos de concurrencia con 409 (compare-and-set atómico).

> Documentación de trabajo interna (planes de mejora, registros de tareas) en `docs/` — no versionada.

# Resumen del ERP — Control de Producción

> Generado el 2026-06-12. Estado del proyecto: rama `mejoras/fase-1`.

Sistema para una fábrica de calzado (~10 personas): gestiona el flujo
**modelo → vale de producción → registro de trabajo por operario → revisión de calidad → pago de mano de obra → venta**.
Backend NestJS + PostgreSQL, frontend React/Vite.

---

## ✅ Lo que YA tiene hoy (funcional)

### Negocio (el core)

- **Materiales** — catálogo CRUD (insumos: cueros, suelas, etc.).
- **Operarios** — catálogo de trabajadores CRUD.
- **Referencias (modelos)** — catálogo de modelos de zapato con `precioVenta`, tarifas de mano de
  obra por oficio y receta de materiales. **+ Foto del modelo** (subir desde la cámara del celular,
  una por referencia, GET público para `<img>`, POST/DELETE solo ADMIN).
- **Vales de producción** — crear vale (modelo + tallas + cantidades), listar, ver detalle.
  IDs por secuencia de PostgreSQL (`V-0001`), sin colisiones.
- **Registro de producción** — anotar pares trabajados por operario/oficio dentro de un vale,
  con validación de cupo atómica (no se puede sobre-registrar).
- **Máquina de estados** `registrado → aprobado → pagado` con transiciones controladas y monto
  congelado al aprobar (pares × tarifa).
- **Revisión de calidad con rechazos** (Fase 6.2) — "Revisar OK" ya **no es todo-o-nada**: se
  aprueban N de M pares; los rechazados se archivan con motivo en tabla `rechazos` y liberan cupo
  para reproceso. Trazabilidad `revisadoPor`/`revisadoEn`. Endpoint de reportes de rechazos.
- **Pagos de nómina** — consolidado por operario, pago individual y por **lote**, anulación de pago.
  Todo transaccional con lock pesimista (sin doble pago). El dinero tiene **una sola puerta**:
  pagar/anular vive solo en la pestaña Pagos.
- **Ventas / despachos** — CRUD de ventas (registro contable interno).

### Plataforma / calidad (Fases 0–4 mayormente hechas)

- **Autenticación JWT** con roles (ADMIN hoy, OPERARIO previsto), guards globales *fail-closed*,
  login con rate-limit, cambio de contraseña, script `create-admin`.
- **Seguridad HTTP**: prefijo `/api/v1`, helmet, CORS restringido, throttling, límite de body,
  filtro de excepciones sin fuga de internals.
- **Integridad de datos**: migraciones TypeORM (sin `synchronize`), config validada con Joi
  (fail-fast), seed como comando manual.
- **Tests**: unit (lógica de negocio ≥80%), e2e del flujo completo, **CI** (lint+build+test+audit) +
  Dependabot.
- **Operabilidad**: logging estructurado, **auditoría transaccional** (quién pagó/anuló/aprobó),
  **Swagger** en `/api/docs`, **health check** con ping a BD.

---

## ⬜ Lo que FALTA según el plan

### Fase 4 — Operabilidad (casi terminada)

- **4.5 Paginación** — `GET /vales`, `/pagos`, `/ventas` hoy cargan todo sin límite; falta
  `?page=&limit=` + filtros por fecha (y actualizar el frontend).
- **4.6 Despliegue reproducible** — Dockerfile del backend, compose con backend + Postgres no
  expuesto, reverse proxy con TLS (Caddy), guía de instalación y backups.

### Fase 5 — Pulido (post-entrega)

- **5.1** Mappers tipados y eliminar los `any` (67 errores de lint preexistentes), strict flags de TS.
- **5.2** Consistencia de dominio (`Pago.etapa` al enum `Oficio`, fechas a tipo `date`, montos a
  `numeric`).
- **5.3** Higiene de repos (ESLint del frontend, licencia, `pnpm audit`).

### Backlog post-entrega (documentado, no se implementa aún)

- Soft-delete (desactivar operarios/materiales/modelos sin romper historial).
- Exportar a Excel/CSV pagos y ventas.
- PWA instalable, fuentes autoalojadas.
- **Rol OPERARIO activo** (login para operarios, registran su propia producción) — el diseño ya lo
  soporta.
- **Landing / storefront** (catálogo público, entidad `Cliente` + `Pedido`, pasarela de pagos por
  webhooks) — visión arquitectónica ya trazada.

---

## Estado de entrega

Según el tablero del plan, el hito al cliente es **fin de Fase 4 + Fase 6**.
Lo único bloqueante que queda es **4.5 (paginación)** y **4.6 (despliegue)**; la Fase 6
(foto del modelo + revisión de calidad) ya está completa. La Fase 5 es pulido posterior.

| Fase | Tareas | Estado |
|------|--------|--------|
| 0. Preparación | 0.1 | ✅ |
| 1. Integridad de datos | 1.1 · 1.2 · 1.3 · 1.4 · 1.5 | ✅ |
| 2. Seguridad perimetral | 2.1 · 2.2 · 2.3 · 2.4 | ✅ |
| 3. Tests y CI | 3.1 · 3.2 · 3.3 · 3.4 | ✅ |
| 4. Operabilidad | 4.1 ✅ · 4.2 ✅ · 4.3 ✅ · 4.4 ✅ · 4.5 ⬜ · 4.6 ⬜ | 🔄 |
| 5. Pulido | 5.1 · 5.2 · 5.3 | ⬜ |
| 6. Funcionalidades | 6.1 ✅ · 6.2 ✅ | ✅ |

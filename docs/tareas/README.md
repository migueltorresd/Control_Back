# Tareas del plan de mejoras — índice de ejecución

> Plan maestro con todo el contexto (hallazgos, patrones, OWASP): [../PLAN-MEJORAS-CALIDAD.md](../PLAN-MEJORAS-CALIDAD.md)

Cada archivo de esta carpeta es una tarea **autocontenida y ejecutable**. Forma de trabajo: abre una sesión con cualquier IA y dile, por ejemplo:

```
Implementa la tarea descrita en docs/tareas/1.2-migraciones-typeorm.md
respetando las reglas de docs/tareas/README.md
```

Al terminar cada tarea: verifica el criterio de aceptación, marca el checkbox aquí y en el plan maestro, y haz **un commit por tarea** antes de seguir.

## Reglas para el implementador (humano o IA) — obligatorias en TODAS las tareas

1. **Una tarea por vez, en orden.** Commit por tarea con formato `feat(scope): ...` / `fix(scope): ...` / `test(scope): ...`.
2. **Convenciones del proyecto**: comunicación entre módulos solo service→service (nunca el repository de otro módulo); queries solo en repositories; todo input HTTP entra por DTO con `class-validator`; mensajes de error y validación **en español**, como los existentes.
3. **No romper el contrato del frontend** (`e:\proyectos\control-produccion\src\services\api.js` define rutas y shapes). Si la tarea cambia rutas o shapes, la misma tarea actualiza el frontend.
4. **Definition of Done**: `pnpm build` y `pnpm test` pasan; `pnpm lint` **no introduce errores nuevos** respecto a la línea base (existen 67 errores preexistentes por los `any` del código original — auditados el 2026-06-11 — que se eliminan en la tarea 5.1; desde la 5.1 en adelante, lint debe quedar en cero); el criterio de aceptación se verificó; checkbox marcado.
5. **Nunca**: reintroducir `synchronize: true`; exponer entidades TypeORM en respuestas HTTP nuevas; secretos en el repo; `any` en código nuevo; SQL crudo con interpolación de strings (siempre parámetros); `dangerouslySetInnerHTML` en el frontend.
6. **Entorno local**: PostgreSQL con `docker compose up -d` (raíz del backend); backend `pnpm start:dev` (puerto 3001); frontend `pnpm dev` (puerto 3000, proyecto `e:\proyectos\control-produccion`).
7. Toda variable de entorno nueva se añade a `.env.example` y al esquema de validación Joi (existente desde la tarea 1.1).
8. **Prohibido inventar alcance**: hacer exactamente lo que la tarea pide, nada más. Sin refactors oportunistas, sin dependencias no listadas en la tarea, sin renombrar archivos/rutas que la tarea no menciona, sin "mejoras" extra. Si un paso admite dos interpretaciones, elegir la **más simple** que cumpla el criterio de aceptación y anotar la decisión en el mensaje del commit. Si algo bloquea la tarea (un supuesto que no se cumple en el código real), **detenerse y reportarlo** en vez de improvisar una solución.

## Verificación de tareas completadas (protocolo de auditoría)

Una tarea no se marca ✅ por tener un commit con el nombre correcto — se marca cuando se **auditó contra sus criterios de aceptación, ejecutándolos literalmente**. Protocolo (aplicado por primera vez el 2026-06-11 sobre 0.1 y 1.1):

1. **Revisar el código** contra los pasos de la tarea (archivos creados/eliminados/modificados coinciden con lo especificado).
2. **Ejecutar cada criterio de aceptación tal como está escrito**, no asumirlo: si dice "sin `.env` la app no arranca", renombrar el `.env`, arrancar, ver el error y restaurar; si dice "`GET /vales` responde", levantar BD + app y hacer el request. Los greps del criterio se corren de verdad.
3. **Correr `pnpm build` y `pnpm test`**; `pnpm lint` se compara contra la línea base (regla 4).
4. **Dejar registro en el archivo de la tarea**: sección `## Registro de verificación` con fecha, qué se ejecutó y el resultado. Sin registro, la tarea no está verificada.
5. Solo entonces: checkbox ✅ en este índice (con el hash del commit) y en el tablero del plan maestro.

> Si la auditoría encuentra un desvío, no se marca la tarea: se anota el hallazgo en el registro y se corrige (en la misma tarea si es de su alcance, o anotándolo en la tarea futura que corresponda — como se hizo con los 67 errores de lint preexistentes → tarea 5.1).

⚠️ **Trampa conocida — `pnpm lint` modifica archivos**: el script de lint tiene `--fix` incorporado (`eslint ... --fix`), así que correrlo **reformatea el código** (prettier) además de reportar. Consecuencias prácticas: (1) en auditorías de solo-lectura, usar `pnpm exec eslint "{src,apps,libs,test}/**/*.ts"` **sin** `--fix`; (2) si una corrida de lint dejó cambios de formato masivos en el árbol, commitearlos **aparte y primero** (`style: apply prettier formatting via lint --fix`) para que el commit de la tarea contenga solo sus cambios reales. Detectado el 2026-06-11: la auditoría de 0.1/1.1 reformateó ~47 archivos que se mezclaron con el inicio de la 1.2.

## Orden de ejecución

| ✓ | Tarea | Archivo | Fase |
|---|-------|---------|------|
| ✅ | 0.1 Línea base | [0.1-linea-base.md](0.1-linea-base.md) — commit `02523a0` | 0 — Preparación |
| ✅ | 1.1 Configuración validada | [1.1-configuracion-validada.md](1.1-configuracion-validada.md) — commit `0b45dfa` | 1 — Integridad de datos |
| ✅ | 1.2 Migraciones TypeORM | [1.2-migraciones-typeorm.md](1.2-migraciones-typeorm.md) — commit `e04fbe0` | 1 |
| ✅ | 1.3 Seed como comando | [1.3-seed-comando.md](1.3-seed-comando.md) — commit `94c35e1` | 1 |
| ✅ | 1.4 IDs por secuencia | [1.4-ids-secuencia.md](1.4-ids-secuencia.md) — commit `f5f2714` | 1 |
| ✅ | 1.5 Operaciones atómicas | [1.5-operaciones-atomicas.md](1.5-operaciones-atomicas.md) — commit `8faf7d2` | 1 |
| ✅ | 2.1 Filtro de excepciones seguro | [2.1-filtro-excepciones.md](2.1-filtro-excepciones.md) — commit `3620338` | 2 — Seguridad perimetral |
| ✅ | 2.2 Autenticación JWT | [2.2-auth-jwt.md](2.2-auth-jwt.md) — commit `428bba6` | 2 |
| ✅ | 2.3 Endurecimiento HTTP + /api/v1 | [2.3-endurecimiento-http.md](2.3-endurecimiento-http.md) — commits `635c698`/front `ebbe36b` | 2 |
| ✅ | 2.4 Login en el frontend | [2.4-login-frontend.md](2.4-login-frontend.md) — commit front (pendiente al cierre del UAT) | 2 |
| ✅ | 3.1 Validación de tallas | [3.1-validacion-tallas.md](3.1-validacion-tallas.md) — commits `ffa17af` + fix `c245192` | 3 — Tests y CI |
| ✅ | 3.2 Unit tests de negocio | [3.2-unit-tests.md](3.2-unit-tests.md) — commit `a6561fd` | 3 |
| ✅ | 3.3 Test e2e del flujo completo | [3.3-e2e-tests.md](3.3-e2e-tests.md) — commit `bbe5f71` | 3 |
| ✅ | 3.4 CI + Dependabot | [3.4-ci.md](3.4-ci.md) — commit `28ebad6` | 3 |
| ⬜ | 4.1 Logging estructurado | [4.1-logging.md](4.1-logging.md) | 4 — Operabilidad |
| ⬜ | 4.2 Auditoría mínima | [4.2-auditoria.md](4.2-auditoria.md) | 4 |
| ⬜ | 4.3 Swagger | [4.3-swagger.md](4.3-swagger.md) | 4 |
| ⬜ | 4.4 Health check | [4.4-health-check.md](4.4-health-check.md) | 4 |
| ⬜ | 4.5 Paginación | [4.5-paginacion.md](4.5-paginacion.md) | 4 |
| ⬜ | 4.6 Despliegue reproducible | [4.6-despliegue.md](4.6-despliegue.md) | 4 |
| ⬜ | 5.1 Mappers y tipado estricto | [5.1-mappers-tipado.md](5.1-mappers-tipado.md) | 5 — Pulido |
| ⬜ | 5.2 Consistencia de dominio | [5.2-consistencia-dominio.md](5.2-consistencia-dominio.md) | 5 |
| ⬜ | 5.3 Higiene de frontend y repos | [5.3-higiene.md](5.3-higiene.md) | 5 |
| ⬜ | 6.1 Imagen del modelo (backend) | [6.1-imagen-referencia.md](6.1-imagen-referencia.md) | 6 — Funcionalidades |
| ⬜ | 6.2 Revisión de calidad con rechazos (backend) | [6.2-revision-calidad.md](6.2-revision-calidad.md) | 6 — Funcionalidades |

**Hito de entrega al cliente: fin de la fase 4** + la fase 6 (pedida por el cliente: 6.1 imagen del modelo → F6; 6.2 revisión de calidad → F9). La fase 5 puede hacerse post-entrega. La 6.1 puede ejecutarse después de la 2.2; la 6.2 después de la 1.5.

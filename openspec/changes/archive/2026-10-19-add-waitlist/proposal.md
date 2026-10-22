# Proposal

## Why

El criterio para pasar de la fase 0 a la app es tener unas 100 viviendas
apuntadas en Madrid (README §3). Sin un formulario de lista de espera que guarde
los datos con consentimiento no hay forma de medirlo (RF-101).

## What Changes

- Formulario de lista de espera en la landing (`#lista-de-espera`): email,
  municipio, tipo de vivienda, qué busca y aceptación de la privacidad.
- Operación `POST /waitlist` de la API (`joinWaitlist` en
  `docs/api/openapi.yaml`): valida, guarda y responde `202` también si el email
  ya estaba apuntado, para no revelar quién está en la lista.
- Limitación de peticiones por origen con `429` y `Retry-After`.
- Primera tabla de la base de datos (`waitlist`) y la cadena de migraciones con
  drizzle-kit (`pnpm db:migrate`), incluida la extensión PostGIS.
- Formato único de error de la API (`Problem`, RFC 9457, con `correlationId`)
  para todas las operaciones presentes y futuras.
- Fuera de alcance: correo de confirmación (necesita el SMTP de Gmail),
  exportación para el admin (`adminListWaitlist`, llega con `add-admin-panel`)
  y verificación anti-bots de terceros (pendiente de decisión).

## Capabilities

### New Capabilities

- `waitlist`: alta en la lista de espera desde la landing, con consentimiento,
  sin revelar inscripciones previas y con protección frente al abuso.
- `api-errors`: formato único de error de la API y su identificador de
  correlación.

### Modified Capabilities

Ninguna.

## Impact

- `services/api`: Fastify con validación, tabla `waitlist` con Drizzle, módulo
  de errores, limitación de peticiones y CORS para el origen de la landing.
- `db/migrations`: primera migración (extensiones `postgis` y `citext`, tabla
  `waitlist`).
- `apps/landing`: formulario accesible con validación en cliente.
- `packages/shared`: esquema Zod de `WaitlistInput` compartido.
- Dependencias: `drizzle-orm`, `drizzle-kit`, `postgres`, `@fastify/cors`,
  `@fastify/rate-limit`, `testcontainers`.

**Capacidad principal**: `waitlist`

## Trazabilidad

| Nivel | Decisión | Motivo |
|---|---|---|
| Epic | nuevo | No existe `cap:waitlist`; `api-errors` se enlaza como relacionada |
| Feature | nuevo | Change nuevo |
| Story | nuevo | Una por requisito del spec delta |
| Task | nuevo | Una por línea de `tasks.md` |

| Requirement | Decisión | Story Points | Prioridad |
|---|---|---|---|
| Alta en la lista de espera | nuevo | 5 | P1 |
| Validación de los datos | nuevo | 2 | P1 |
| Inscripciones repetidas sin revelar | nuevo | 2 | P1 |
| Protección frente al abuso | nuevo | 3 | P2 |
| Formulario en la landing | nuevo | 3 | P1 |
| Formato único de error | nuevo | 3 | P1 |

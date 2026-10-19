# Design

## Context

Primera funcionalidad con API y base de datos. `services/api` tiene el
esqueleto hexagonal sin rutas; PostgreSQL + PostGIS corre en Docker
(`pnpm infra:up`). El contrato ya define `joinWaitlist`, `WaitlistInput` y
`Problem` (`docs/api/openapi.yaml`). Motivación en `proposal.md`.

## Goals / Non-Goals

**Goals:**
- Dejar establecidos los patrones que reutilizarán todos los changes: capas
  hexagonales, validación con Zod compartido, errores `Problem`, Drizzle con
  migraciones versionadas y pruebas de integración con PostgreSQL real.

**Non-Goals:**
- Autenticación (no la necesita esta operación pública), correo de
  confirmación, exportación, purga por retención.

## Decisions

- **Capas**: `domain/waitlist` (entidad `WaitlistEntry` y normalización del
  email, sin dependencias), `application/waitlist/join-waitlist.ts` (caso de uso
  con el puerto `WaitlistRepository`), `infrastructure/persistence/drizzle`
  (esquema, cliente y `DrizzleWaitlistRepository`), `interfaces/http/routes/waitlist.ts`.
- **Idempotencia del email**: columna `email citext UNIQUE` y
  `INSERT … ON CONFLICT DO NOTHING`; el caso de uso responde igual en ambos
  casos. Alternativa descartada: consultar antes de insertar — carrera entre
  dos altas simultáneas y una consulta más.
- **Validación**: esquema Zod `waitlistInputSchema` en `packages/shared`,
  usado por la landing y por la API (adaptado a Fastify con
  `fastify-type-provider-zod`). Una sola fuente para ambos lados.
- **Errores**: plugin `problem` en `interfaces/http` que traduce errores de
  validación (400 con `errors`), `404`, `429` y errores no controlados (500
  genérico) a `Problem`; `correlationId` desde `X-Correlation-Id` o generado
  (UUID v7), devuelto también en la cabecera y añadido al logger de la
  petición. Se documenta la cabecera en el contrato.
- **Límite de peticiones**: `@fastify/rate-limit` en la ruta (5 altas por
  origen cada 10 minutos, configurable por entorno). En Cloud Run se usa la IP
  del cliente desde `X-Forwarded-For` (proxy de confianza).
- **CORS**: solo el origen de la landing del entorno (`LANDING_ORIGIN`).
- **Migraciones**: `drizzle-kit generate` produce SQL en `db/migrations`; la
  primera migración crea `postgis` y `citext`. `pnpm db:migrate` aplica con el
  migrador de Drizzle. Nunca `push`.
- **Pruebas**: unitarias del dominio y del caso de uso con un repositorio en
  memoria; integración (`*.int.test.ts`) de la ruta completa con PostgreSQL de
  Testcontainers y migraciones reales; landing con Vitest (lógica del
  formulario) y Playwright (envío contra una API simulada en la red).

## Risks / Trade-offs

- [Sin anti-bots de terceros] → límite por origen; se revisará con datos reales.
- [Limitación en memoria por instancia de Cloud Run] → aceptable en fase 0
  (instancias mínimas); con más tráfico, almacén compartido.

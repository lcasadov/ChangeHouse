# Tasks

## 1. Persistencia y migraciones

- [ ] B1 Añadir Drizzle, el esquema de `waitlist` (email `citext` único, municipio, tipo, qué busca, fecha de consentimiento), la primera migración con `postgis` y `citext` y el script `pnpm db:migrate`, y verificar que la migración se aplica sobre el PostgreSQL local. ref: Alta en la lista de espera · est: 3h · disc: bd
  - GIVEN una base de datos vacía WHEN se ejecuta `pnpm db:migrate` THEN existen las extensiones y la tabla `waitlist`

## 2. Formato de error

- [ ] T1 Escribir las pruebas del plugin de errores (400 con `errors`, 404, 500 sin detalles internos, `correlationId` propagado desde `X-Correlation-Id`) y comprobar que fallan. ref: Formato único de error · est: 2h · disc: qa
  - GIVEN un error no controlado WHEN la API responde THEN el cuerpo no contiene la traza ni el mensaje interno
- [ ] B2 Implementar el plugin `problem` y la correlación en el logger, documentar la cabecera `X-Correlation-Id` en `docs/api/openapi.yaml` y verificar que pasan las pruebas de T1. ref: Formato único de error · est: 3h · disc: back
  - GIVEN una petición con `X-Correlation-Id` WHEN falla THEN la respuesta devuelve ese mismo identificador

## 3. Alta en la lista de espera

- [ ] T2 Escribir las pruebas unitarias del dominio (normalización del email) y del caso de uso con un repositorio en memoria (alta nueva, email repetido con otra capitalización) y comprobar que fallan. ref: Inscripciones repetidas sin revelar · est: 2h · disc: qa
  - GIVEN un email ya inscrito en mayúsculas WHEN se da de alta en minúsculas THEN el caso de uso informa «aceptado» sin crear otra inscripción
- [ ] B3 Implementar la entidad, el caso de uso `joinWaitlist` y el puerto `WaitlistRepository`, y verificar que pasan las pruebas de T2. ref: Alta en la lista de espera · est: 2h · disc: back
  - GIVEN datos válidos WHEN se ejecuta el caso de uso THEN el repositorio recibe la inscripción con la fecha de consentimiento
- [ ] T3 Escribir las pruebas de integración de `POST /waitlist` con PostgreSQL en Testcontainers (202, consentimiento obligatorio, email no válido, tipo desconocido, repetido sin revelar) y comprobar que fallan. ref: Validación de los datos · est: 3h · disc: qa
  - GIVEN un alta con `homeType` desconocido WHEN se envía THEN la respuesta es 400 con `homeType` señalado y la tabla sigue vacía
- [ ] B4 Implementar el esquema Zod compartido en `packages/shared`, el repositorio Drizzle con `ON CONFLICT DO NOTHING`, la ruta `POST /waitlist` y CORS para `LANDING_ORIGIN`, y verificar que pasan las pruebas de T3. ref: Validación de los datos · est: 4h · disc: back
  - GIVEN dos altas simultáneas con el mismo email WHEN terminan THEN hay una sola inscripción y ambas reciben 202

## 4. Protección frente al abuso

- [ ] T4 Escribir la prueba de integración del límite de altas por origen (429 con `Retry-After`, sin guardar) y comprobar que falla. ref: Protección frente al abuso · est: 1h · disc: qa
  - GIVEN el límite alcanzado WHEN llega otra alta THEN la respuesta es 429 con `Retry-After`
- [ ] B5 Configurar `@fastify/rate-limit` en la ruta con valores por entorno y la IP real tras el proxy, y verificar que pasa la prueba de T4. ref: Protección frente al abuso · est: 2h · disc: back
  - GIVEN la configuración por defecto WHEN se envían seis altas en diez minutos desde un origen THEN la sexta recibe 429

## 5. Formulario en la landing

- [ ] T5 Escribir las pruebas de la lógica del formulario (validación por campo con el esquema compartido, doble envío, estados de éxito y error) y las E2E con la API simulada, y comprobar que fallan. ref: Formulario en la landing · est: 3h · disc: qa
  - GIVEN la API simulada respondiendo 429 WHEN se envía el formulario THEN se muestra el mensaje de reintento y los datos se conservan
- [ ] F1 Implementar el formulario accesible en `#lista-de-espera` con errores junto a cada campo, botón bloqueado durante el envío y confirmación anunciada, y verificar que pasan las pruebas de T5. ref: Formulario en la landing · est: 4h · disc: front
  - GIVEN un envío correcto WHEN responde la API THEN el mensaje de confirmación se anuncia con `aria-live`

## 6. Integración

- [ ] V1 Ejecutar `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage`, `pnpm test:integration`, `pnpm test:e2e` y `pnpm build` desde la raíz y verificar que todo pasa con cobertura ≥ 80 %. ref: Alta en la lista de espera · est: 1h · disc: qa
  - GIVEN el change implementado WHEN se ejecuta la puerta de calidad local THEN todos los comandos terminan con éxito

## Workflow follow-up

- `/opsx:verify`, `/opsx:sync` y `/opsx:archive` tras la implementación.

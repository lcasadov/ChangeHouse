# Tasks

## 1. Autenticación de las peticiones

- [ ] T1 Escribir las pruebas del plugin de autenticación (sin token, token caducado, firma alterada, token válido) con el emulador de Auth y comprobar que fallan; verificar que el registro nunca contiene el token. ref: Autenticación de las peticiones · est: 3h · disc: qa
  - GIVEN un token caducado WHEN llega a una operación protegida THEN la respuesta es 401 y el log no incluye el token
- [ ] B1 Implementar el puerto `IdentityVerifier`, el adaptador de `firebase-admin` con soporte de emulador, el plugin de autenticación y el arranque del emulador en el job `integration` de la CI, y verificar que pasan las pruebas de T1. ref: Autenticación de las peticiones · est: 4h · disc: back
  - GIVEN la operación `joinWaitlist` WHEN llega sin token THEN sigue respondiendo 202

## 2. Autorización centralizada

- [ ] T2 Escribir la prueba parametrizada que recorre `services/api/test/authorization/rbac-matrix.json` y las de denegación por defecto y 403 en `/admin/*`, y comprobar que fallan. ref: Roles y denegación por defecto · est: 3h · disc: qa
  - GIVEN una operación implementada sin filas en la matriz WHEN se ejecuta la prueba THEN falla nombrando la operación
- [ ] B2 Implementar la política por `operationId`, el `preHandler` global, la derivación de roles con el puerto `HomeOwnership` y el registro de denegaciones, y verificar que pasan las pruebas de T2. ref: Roles y denegación por defecto · est: 4h · disc: back
  - GIVEN un `seeker` WHEN invoca una operación de administración THEN recibe 403 con `correlationId`

## 3. Alta, cuenta y consentimientos en la API

- [ ] B3 Crear las tablas `users` y `consents` con su migración y cerrar los esquemas de entrada del contrato (`additionalProperties: false`), y verificar que la migración se aplica y que Redocly valida el contrato. ref: Alta en ChangeHouse con consentimiento · est: 2h · disc: bd
  - GIVEN la base de datos migrada WHEN se inspecciona THEN existen `users` (con `firebase_uid` y `email` únicos) y `consents`
- [ ] T3 Escribir las pruebas unitarias de los casos de uso (alta con consentimientos, alta sin aceptar, alta repetida, nueva versión de privacidad) y las de integración de `/me` y `/me/consents`, y comprobar que fallan. ref: Alta en ChangeHouse con consentimiento · est: 3h · disc: qa
  - GIVEN un usuario ya dado de alta WHEN repite `PUT /me` THEN la respuesta es 200 y sigue habiendo un solo usuario
- [ ] B4 Implementar los casos de uso, los repositorios Drizzle y las rutas `getMe`, `upsertMe`, `listMyConsents` y `acceptConsent`, añadir sus filas a la matriz como datos y verificar que pasan las pruebas de T3. ref: Consulta de la propia cuenta y de los consentimientos · est: 4h · disc: back
  - GIVEN un usuario sin viviendas WHEN consulta `GET /me` THEN recibe el rol `seeker` y `hasPublishedHome` falso

## 4. Acceso en la app

- [ ] T4 Escribir las pruebas de componentes del flujo de acceso (registro, contraseña corta, credenciales incorrectas, Google/Apple con dobles, sesión recordada, cerrar sesión, verificación pendiente, recuperar contraseña) y comprobar que fallan. ref: Registro e inicio de sesión · est: 4h · disc: qa
  - GIVEN credenciales incorrectas WHEN se intenta entrar THEN el mensaje no revela si el email existe
- [ ] F1 Implementar Firebase Auth con persistencia, las pantallas de bienvenida, acceso, verificación y recuperación con el diseño de la guía, y la protección de las pestañas, y verificar que pasan las pruebas de T4. ref: Registro e inicio de sesión · est: 6h · disc: front
  - GIVEN un usuario sin sesión WHEN abre una pestaña protegida THEN se le redirige a la bienvenida
- [ ] F2 Implementar el aviso de email sin verificar con reenvío y la recuperación de contraseña con mensaje neutro, y verificar las pruebas correspondientes de T4. ref: Verificación del email y recuperación de la contraseña · est: 2h · disc: front
  - GIVEN un email inexistente WHEN se pide recuperar la contraseña THEN se muestra el mismo mensaje que para uno existente
- [ ] T5 Escribir las pruebas de la pantalla de alta (nombre visible, aceptación obligatoria de términos y privacidad) contra la API simulada y comprobar que fallan. ref: Alta en ChangeHouse con consentimiento · est: 2h · disc: qa
  - GIVEN la pantalla de alta sin aceptar privacidad WHEN se pulsa continuar THEN se indica que falta aceptarla y no se llama a la API
- [ ] F3 Implementar el cliente HTTP tipado (`openapi-typescript` + `openapi-fetch` con el token) y la pantalla de alta en ChangeHouse, y verificar que pasan las pruebas de T5. ref: Alta en ChangeHouse con consentimiento · est: 4h · disc: front
  - GIVEN un alta completada WHEN responde la API THEN la app muestra las pestañas

## 5. Integración

- [ ] V1 Ejecutar `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage`, `pnpm test:integration` (con PostgreSQL y el emulador de Auth) y `pnpm build`, y verificar que todo pasa con cobertura ≥ 80 %. ref: Roles y denegación por defecto · est: 1h · disc: qa
  - GIVEN el change implementado WHEN se ejecuta la puerta de calidad local THEN todos los comandos terminan con éxito

## Workflow follow-up

- `/opsx:verify`, `/opsx:sync` y `/opsx:archive` tras la implementación.

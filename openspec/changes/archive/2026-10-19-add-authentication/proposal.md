# Proposal

## Why

Todo lo que sigue —publicar una vivienda, descubrir, dar me gusta, hacer
match— exige saber quién es el usuario y qué puede hacer. Sin un acceso sencillo
y una autorización centralizada desde el principio, cada funcionalidad
inventaría la suya (RF-01, RF-02, RF-04, RNF-01, RNF-02).

## What Changes

- Acceso a la app en tres toques: registro e inicio de sesión con email y
  contraseña, Google y Apple; verificación del email y recuperación de la
  contraseña.
- Alta del usuario en ChangeHouse en el primer acceso, con nombre visible y la
  aceptación de términos y privacidad registrada con versión y fecha
  (`upsertMe`, `getMe`, `listMyConsents`, `acceptConsent`).
- Autorización centralizada en la API: verificación del ID token en cada
  petición, roles derivados (`owner`/`seeker`) y asignados (`agency`/`admin`),
  denegación por defecto y respuestas 401/403/404 según
  `docs/rbac-matrix.md` §6, con la matriz como datos para la prueba
  parametrizada.
- Pantallas de bienvenida, acceso, verificación y recuperación con el diseño de
  la guía; las pestañas solo se muestran con sesión iniciada.
- Fuera de alcance: edición del perfil (`add-user-profile`), eliminación y
  exportación de la cuenta, suspensiones. Google y Apple quedan implementados
  y probados con dobles; su activación real necesita los identificadores de
  cliente de Google y la cuenta de Apple Developer.

## Capabilities

### New Capabilities

- `accounts`: registro, acceso, verificación del email, recuperación de la
  contraseña, alta del usuario en ChangeHouse y consentimientos.
- `authorization`: autenticación de las peticiones a la API, roles y
  denegación por defecto.

### Modified Capabilities

Ninguna.

## Impact

- `services/api`: tablas `users` y `consents`, plugin de autenticación, política
  de autorización central, rutas `/me` y `/me/consents`.
- `apps/mobile`: Firebase Auth (SDK web con persistencia nativa), flujo de
  acceso, protección de rutas, cliente HTTP tipado desde OpenAPI.
- `packages/shared`: esquemas de `MeInput`, `ConsentInput`, versiones vigentes
  de los textos legales.
- Pruebas de integración con el emulador de Firebase Auth (también en la CI).
- Dependencias: `firebase`, `firebase-admin`, `openapi-fetch`,
  `openapi-typescript`, `@react-native-async-storage/async-storage`.

**Capacidad principal**: `accounts`

## Trazabilidad

| Nivel | Decisión | Motivo |
|---|---|---|
| Epic | nuevo | No existe `cap:accounts`; `authorization` se enlaza como relacionada |
| Feature | nuevo | Change nuevo |
| Story | nuevo | Una por requisito del spec delta |
| Task | nuevo | Una por línea de `tasks.md` |

| Requirement | Decisión | Story Points | Prioridad |
|---|---|---|---|
| Registro e inicio de sesión | nuevo | 5 | P1 |
| Verificación del email y recuperación de la contraseña | nuevo | 3 | P1 |
| Alta en ChangeHouse con consentimiento | nuevo | 3 | P1 |
| Consulta de la propia cuenta y de los consentimientos | nuevo | 2 | P1 |
| Autenticación de las peticiones | nuevo | 3 | P1 |
| Roles y denegación por defecto | nuevo | 5 | P1 |

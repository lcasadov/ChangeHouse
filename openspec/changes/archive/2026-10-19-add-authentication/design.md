# Design

## Context

Hay patrones de API asentados por `add-waitlist` (capas, Zod compartido,
`Problem`, Drizzle, Testcontainers) y una app con navegación de cuatro pestañas,
tokens, i18n y primitivas (`#16`). El contrato define `getMe`, `upsertMe`,
`listMyConsents` y `acceptConsent`; la matriz de permisos y sus reglas críticas
están en `docs/rbac-matrix.md`. Motivación en `proposal.md`.

## Goals / Non-Goals

**Goals:**
- Un único punto de autorización que todos los changes posteriores amplían
  añadiendo filas a la matriz como datos.
- Acceso en tres toques con el diseño de la guía.

**Non-Goals:**
- Edición del perfil, borrado de la cuenta, suspensiones, KYC.

## Decisions

- **Firebase Auth en el cliente con el SDK web** (`firebase/auth`) y
  persistencia en `AsyncStorage` en nativo; funciona en Expo Go, en
  *development builds* y en web con el mismo código. Alternativa descartada:
  `@react-native-firebase/auth` — mejor integración nativa, pero obliga a
  *development builds* desde el primer día y duplica el código para web.
- **Google y Apple** con `expo-auth-session` y `expo-apple-authentication`,
  intercambiando la credencial por una sesión de Firebase. Sus botones se
  muestran solo si su configuración existe (`EXPO_PUBLIC_GOOGLE_*`,
  plataforma iOS para Apple); las pruebas sustituyen el proveedor.
- **Verificación en la API con `firebase-admin`** detrás del puerto
  `IdentityVerifier` (`application/auth`), adaptador en
  `infrastructure/auth/firebase-identity-verifier.ts`. En local y en CI apunta
  al emulador de Auth (`FIREBASE_AUTH_EMULATOR_HOST`); la CI arranca el
  emulador en el job `integration`.
- **Política de autorización como datos**: `interfaces/http/authorization/policy.ts`
  declara por `operationId` los actores permitidos y la condición contextual;
  un hook global `onRequest` (antes de leer el cuerpo, así un cuerpo inválido no adelanta al 401) la aplica a cada ruta por su `operationId` y deniega
  lo no declarado. La prueba parametrizada lee
  `services/api/test/authorization/rbac-matrix.json`.
- **Roles**: `assigned_role` en `users` (`agency`, `admin` o nulo);
  `owner`/`seeker` se derivan con el puerto `HomeOwnership`. Hasta que exista
  `add-home-listing` su implementación devuelve «sin viviendas publicadas» y
  ese change la sustituye por la consulta real.
- **Entradas cerradas**: los esquemas de entrada pasan a
  `additionalProperties: false` en el contrato, de modo que un campo de rol o
  estado da 400 (RC-17).
- **Cliente HTTP tipado**: `openapi-typescript` genera los tipos desde
  `docs/api/openapi.yaml` y `openapi-fetch` añade el token en cada petición.
- **Versiones legales** vigentes como constantes en `packages/shared`
  (`TERMS_VERSION`, `PRIVACY_VERSION`) usadas por la app y validadas en la API.

## Risks / Trade-offs

- [Sin credenciales reales de Google/Apple] → implementación y pruebas con
  dobles; activación pendiente de las cuentas (documentado en el PR).
- [Emulador de Firebase en la CI añade tiempo] → solo en el job de integración.

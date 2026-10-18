# Design

## Context

Existen autenticación, autorización como datos y cuentas (`add-authentication`,
`add-user-profile`). El modelo de `homes` está en `docs/datamodel.md` y las
operaciones en `docs/api/openapi.yaml`. Motivación en `proposal.md`.

## Goals / Non-Goals

**Goals:**
- Alta rápida y sin pérdida de datos, con la ubicación como decisión explícita
  del propietario.

**Non-Goals:**
- Fotos, moderación, VPP, pausa y reactivación (changes propios).

## Decisions

- **Dominio**: entidad `Home` con su máquina de estados (`draft → in_review`;
  edición permitida en `draft`, `in_review`, `published`, `paused`) y la regla
  de completitud para el envío; `Money` en céntimos; sin dependencias.
- **Dirección**: el cliente usa el autocompletado de Google Places (clave
  restringida por app en `EXPO_PUBLIC_GOOGLE_PLACES_KEY`) y envía `placeId` y
  el texto. El servidor resuelve el `placeId` con el puerto `PlaceResolver`
  (punto exacto, barrio o zona y su centro) usando Places Details con una clave
  de servidor. En local y en pruebas, `FixturePlaceResolver` con un catálogo
  pequeño de lugares de prueba, y el cliente muestra las mismas sugerencias de
  prueba cuando no hay clave. Alternativa descartada: geocodificar en el
  cliente — expondría la lógica y permitiría falsear el barrio.
- **Cifrado de la dirección**: AES-256-GCM en la aplicación
  (`infrastructure/crypto`), clave en `ADDRESS_ENCRYPTION_KEY` (Secret Manager
  en DES/PROD); se guarda IV + texto cifrado + etiqueta en `exact_address`.
- **Ubicación pública**: `location_visibility` (`area` por defecto). La forma
  pública devuelve el centro del barrio o zona salvo que el propietario elija
  `exact`.
- **Respuestas según quien consulta**: el caso de uso devuelve una vista
  completa o pública; la política de autorización responde 404 ante una
  vivienda ajena no publicada (no se revela su existencia).
- **Rol `owner`**: `DrizzleHomeOwnership` sustituye al provisional: existe
  alguna vivienda propia en `published`, `paused` o `in_operation`.
- **App**: asistente de 5 pasos con barra de progreso, un formulario por paso
  (React Hook Form + Zod compartido); el primer paso crea la vivienda y los
  siguientes la actualizan. «Mis casas» lista tarjetas con foto (marcador hasta
  que haya fotos), estado y acción principal según el estado.

## Risks / Trade-offs

- [Coste y cuota de Google Places] → solo se llama al resolver en el servidor
  al guardar la dirección; el autocompletado usa sesiones de Places.
- [Rotación de la clave de cifrado] → el formato incluye un identificador de
  versión de clave para poder rotarla sin migración masiva.

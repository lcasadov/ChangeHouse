# Proposal

## Why

Un match solo avanza si los participantes hablan: organizar visitas, resolver
dudas, compartir documentos informales. El chat de grupo por match es parte del
MVP (RF-52, RF-60, RC-16).

## What Changes

- Chat de grupo por match (2 o 3 participantes), creado automáticamente al
  crearse el match.
- Envío de mensajes de texto e imágenes **a través de la API** (nuevas
  operaciones `sendMatchMessage` y `createChatImageUpload`), que comprueba que
  el remitente participa y que el match no está cerrado, y escribe en
  Firestore.
- Lectura en tiempo real desde Firestore, con reglas que solo permiten leer a
  los participantes y no permiten escribir a ningún cliente.
- Un match cerrado deja el chat en solo lectura.
- Las imágenes se procesan como las fotos de vivienda (sin metadatos).

## Capabilities

### New Capabilities

- `chat`: conversación de grupo de los participantes de un match.

### Modified Capabilities

Ninguna.

## Impact

- `services/api`: puerto `ChatChannel` con adaptador de Firestore
  (`firebase-admin`), creación del chat en la transacción de negocio del match
  (patrón *outbox*), rutas nuevas y filas de la matriz.
- `firebase/firestore.rules`: reglas del chat y pruebas con el emulador.
- `docs/api/openapi.yaml`: operaciones `sendMatchMessage` y
  `createChatImageUpload`.
- `apps/mobile`: pantalla de chat con lista en tiempo real, envío e imágenes.

**Capacidad principal**: `chat`

## Trazabilidad

| Nivel | Decisión | Motivo |
|---|---|---|
| Epic | nuevo | No existe `cap:chat` |
| Feature | nuevo | Change nuevo |
| Story | nuevo | Una por requisito del spec delta |
| Task | nuevo | Una por línea de `tasks.md` |

| Requirement | Decisión | Story Points | Prioridad |
|---|---|---|---|
| Chat de grupo por match | nuevo | 3 | P1 |
| Enviar mensajes | nuevo | 5 | P1 |
| Solo los participantes leen el chat | nuevo | 3 | P1 |
| Chat de un match cerrado | nuevo | 2 | P2 |

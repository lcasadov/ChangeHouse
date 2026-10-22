# Design

## Context

Los matches existen con sus participantes (`matching`, `matches`). Firestore
está elegido para el chat en tiempo real (`docs/architecture.md`) y sus reglas
están hoy en denegación total. La autorización debe seguir centralizada en la
API (RNF-01). Motivación en `proposal.md`.

## Decisions

- **Escritura por la API, lectura directa de Firestore**. La API valida al
  remitente y el estado del match y escribe con `firebase-admin`; los clientes
  escuchan `chats/{chatId}/messages` en tiempo real. Las reglas permiten leer si
  `request.auth.uid` está en `chats/{chatId}.participantUids` y deniegan toda
  escritura de cliente. Alternativa descartada: escritura directa del cliente
  con reglas — duplica la autorización fuera de la API y complica moderar y
  notificar.
- **Creación del chat sin acoplar transacciones**: al crear el match se inserta
  un evento en una tabla `outbox` en la misma transacción; un despachador en la
  API (al terminar la petición y con reintento periódico) crea el documento del
  chat. Así un fallo de Firestore no impide el match ni deja matches sin chat.
- **Identidad en Firestore**: `participantUids` guarda los `firebase_uid`
  (lo que conoce `request.auth`); los mensajes guardan el id interno y el nombre
  visible del remitente, nunca el email ni el teléfono.
- **Imágenes**: `createChatImageUpload` emite una URL firmada como en las fotos
  de vivienda; `sendMatchMessage` con `imageUploadId` procesa la imagen
  (reutiliza `ImageProcessor`) y la publica en una ruta privada servida con URL
  firmada de corta duración.
- **Pruebas de reglas** con `@firebase/rules-unit-testing` contra el emulador
  de Firestore (también en el job de integración de la CI).

## Risks / Trade-offs

- [Latencia de un salto más que la escritura directa] → aceptable para chat
  entre 2 y 3 personas; la app muestra el mensaje de forma optimista.
- [Eventos del outbox pendientes] → reintento periódico y métrica de eventos
  sin despachar.

# Design

## Context

Los matches, sus cambios de estado (`add-match-details-and-decisions`) y el
chat de grupo en Firestore (`add-match-chat`) generan los eventos a notificar.
El contrato declara `registerDevice`; el modelo de datos, `user_devices`. El
correo usa la extensión Trigger Email de Firebase con SMTP de Gmail
provisional (la contraseña de aplicación vive en Secret Manager). Motivación en
`proposal.md`.

## Decisions

- **Puerto `Notifier`** en la aplicación con dos adaptadores: FCM (Firebase
  Admin SDK `sendEachForMulticast`) y correo (escritura de un documento en la
  colección `mail` de Firestore que procesa Trigger Email). En pruebas, dobles
  en memoria; en local, el emulador de Firestore para el correo y un doble de
  FCM.
- **Despacho tras confirmar la transacción**: reutiliza la tabla `outbox` y el
  despachador de `add-match-chat`, con nuevos tipos de evento (`match.created`,
  `match.confirmed`, `match.closed`, `message.sent`) escritos en la misma
  transacción que el cambio; el despachador envía, marca como enviados y
  reintenta sin bloquear la respuesta. Un fallo de envío no revierte nada.
- **Mensajes del chat**: como la API escribe los mensajes
  (`sendMatchMessage`), el mismo caso de uso encola `message.sent` para el
  resto de participantes; no hace falta una Cloud Function.
- **Tokens**: `registerDevice` hace *upsert* por token; los tokens que FCM
  marca `registration-token-not-registered` o `invalid-argument` se borran.
- **Contenido**: solo textos genéricos («¡Tenéis un match!», «Nuevo mensaje en
  tu match», «Tu match se ha cerrado») y `matchId` en los datos; nunca
  dirección, teléfono, importes ni el texto del mensaje. Pruebas que lo
  comprueban sobre lo enviado.
- **App**: `expo-notifications`; la petición de permiso se lanza tras el
  primer «Me gusta» con éxito, precedida de una explicación propia; tocar un
  aviso navega al match o a su chat (*deep link* `changehouse://matches/<id>`).
  En web, sin push.

## Risks / Trade-offs

- [Gmail SMTP provisional y con cuota] → solo dos tipos de correo; migrar a un
  proveedor transaccional antes de abrir al público.
- [Despachador en proceso en Cloud Run] → la tabla outbox permite reanudar
  envíos pendientes al arrancar.

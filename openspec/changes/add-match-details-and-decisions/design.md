# Design

## Context

`add-direct-match` crea `matches` y `match_participants` (con `shares_phone` ya
en el esquema, sin uso) y lista los matches del usuario sin teléfono ni
dirección. El contrato declara `getMatch`, `confirmMatch`, `withdrawFromMatch` y
`setPhoneSharing`; `MatchParticipant` ya tiene `phone` y `exactAddress`, pero
`Match` no lleva las viviendas con sus fotos. Motivación en `proposal.md`.

## Decisions

- **Contrato**: `getMatch` devuelve `MatchDetail` = `Match` + `homes`
  (`HomePublic[]` con todas las fotos de cada vivienda del ciclo). Solo en el
  detalle se rellenan `exactAddress` y `phone` de los participantes; la lista
  sigue sin ellos.
- **Autorización por pertenencia**: el calificador `participant` se resuelve
  en el caso de uso leyendo los participantes; quien no participa (y no es
  `admin`) recibe 404 sin que se descifre nada. El `admin` ve el detalle sin
  teléfonos ni direcciones exactas (no los necesita para moderar).
- **Dirección exacta**: se descifra con el `AddressCipher` existente solo
  dentro de `getMatch` y solo para participantes; `exactAddress` de cada
  participante es la dirección de la vivienda que entrega (RN-08).
- **Teléfono**: `phone` = teléfono del perfil del participante si
  `shares_phone` es verdadero en ese match y tiene teléfono; si no, `null`.
  `setPhoneSharing` cambia solo la fila del propio participante; vale en
  `open` y `confirmed`.
- **Dominio** (`domain/matching/match.ts`): participante `pending →
  confirmed`; match `open → confirmed` cuando todos los participantes están
  `confirmed`; retirada desde `open` o `confirmed`: participante `withdrawn` y
  match `closed`. Fuera de esos estados → `MatchNotOpenError` (409). Confirmar
  dos veces es idempotente (200 con el match).
- **Concurrencia**: confirmar y retirarse leen el match con `SELECT … FOR
  UPDATE` en una transacción, para que dos confirmaciones simultáneas lleven
  el match a `confirmed` una sola vez y una retirada simultánea gane sobre la
  confirmación de forma consistente.
- **Registro de la retirada (RN-10)**: entrada en `audit_log` (`match.withdraw`,
  entidad `match`, actor el participante), en la misma transacción.
- **Me gusta tras cerrar**: un match `closed` libera el «Me gusta» para
  deshacerlo (`MatchLookup` ya solo cuenta los no cerrados). Volver a casar el
  mismo ciclo cerrado queda fuera de alcance: la clave única devuelve el match
  cerrado.
- **App**: pantalla de detalle desde «Matches» y desde la celebración:
  cabecera con el estado («Pendiente de confirmar», «Confirmado por todos»,
  «Cerrado»); por cada participante, su vivienda (galería), nombre, dirección
  exacta de la que entrega y su compensación con «Estimación orientativa»;
  interruptor «Compartir mi teléfono en este match»; botones «Confirmar
  interés» y «Retirarme» (confirmación en hoja propia que explica que se cierra
  para todos). Teléfono como enlace `tel:`.

## Risks / Trade-offs

- [Dirección exacta en la respuesta] → solo en `getMatch`, solo a
  participantes, sin caché en la app más allá de la sesión.
- [Retirada irreversible] → confirmación explícita en la app; la API no ofrece
  deshacer.

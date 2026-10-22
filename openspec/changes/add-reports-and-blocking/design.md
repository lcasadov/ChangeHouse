# Design

## Context

Hay viviendas, matches, chats en Firestore escritos por la API
(`add-match-chat`), auditoría de solo inserción y sección de administración
(`add-home-moderation`). El contrato declara `createReport`, `blockUser`,
`adminListReports` y `adminResolveReport`; el modelo de datos, `reports` y
`user_blocks`. Motivación en `proposal.md`.

## Decisions

- **Denuncias**: tabla `reports` (objetivo usuario, vivienda o mensaje;
  motivo; estado `open`, `resolved` o `dismissed`; nota y autor de la
  resolución). Denunciar un mensaje exige participar en su chat (si no, 404)
  y copia el texto y el remitente como evidencia. Límite de 10 denuncias por
  usuario y hora (429).
- **Bloqueos**: `user_blocks(blocker_id, blocked_id)` con efecto en los dos
  sentidos: el descubrimiento excluye viviendas de usuarios bloqueados en
  cualquier sentido, y la detección de ciclos descarta ciclos con dos
  participantes bloqueados entre sí. Bloquear no cierra matches existentes
  (el usuario puede retirarse). Idempotente (204).
- **Revisión**: `adminListReports` por antigüedad con la evidencia;
  `adminResolveReport` con decisión y nota obligatoria, auditada
  (`report.resolve` o `report.dismiss`) en la misma transacción.
- **App**: menú «Más opciones» en el detalle de vivienda ajena, en el detalle
  de match y en cada mensaje, con «Denunciar» (hoja con motivos frecuentes y
  texto) y «Bloquear» (confirmación); en «Administración», sección
  «Denuncias» con cola y resolución.

## Risks / Trade-offs

- [Abuso de las denuncias] → límite por hora; la revisión es humana.

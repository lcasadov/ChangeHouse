# Proposal

## Why

Antes de abrir la app a usuarios reales, cualquiera debe poder denunciar un
abuso y dejar de ver a quien le molesta, y el equipo debe poder revisarlo (RF-63,
riesgo de fraude, README §15).

## What Changes

- Denunciar un usuario, una vivienda o un mensaje con un motivo
  (`createReport`), con limitación de peticiones; la denuncia de un mensaje
  guarda una copia del mensaje como evidencia.
- Bloquear a un usuario (`blockUser`): ambos dejan de verse en el descubrimiento
  y no pueden formar matches nuevos entre sí.
- Cola de denuncias para el admin (`adminListReports`) y resolución
  (`adminResolveReport`) con auditoría.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `moderation`: denuncias y bloqueos.

## Impact

- `services/api`: tablas `reports` y `user_blocks`, filtros de bloqueo en el
  descubrimiento y en el matching, rutas y filas de la matriz.
- `apps/mobile`: acción «Denunciar» en tarjetas, detalle de match y mensajes;
  «Bloquear»; cola de denuncias en «Administración».

**Capacidad principal**: `moderation`

## Trazabilidad

| Nivel | Decisión | Motivo |
|---|---|---|
| Epic | existente | Epic de `moderation` |
| Feature | nuevo | Change nuevo |
| Story | nuevo | Una por requisito del spec delta |
| Task | nuevo | Una por línea de `tasks.md` |

| Requirement | Decisión | Story Points | Prioridad |
|---|---|---|---|
| Denunciar | nuevo | 3 | P1 |
| Bloquear a un usuario | nuevo | 3 | P1 |
| Revisión de denuncias | nuevo | 3 | P1 |

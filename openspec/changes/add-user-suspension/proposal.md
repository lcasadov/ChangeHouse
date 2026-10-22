# Proposal

## Why

Bloquear protege a un usuario; suspender protege a todos. El equipo necesita
cortar a un usuario reincidente o fraudulento sin borrar sus datos, que pueden
ser evidencia (RF-90, RF-93).

## What Changes

- Suspender o reactivar a un usuario con motivo obligatorio
  (`adminSetUserSuspension`), con auditoría.
- Un usuario suspendido recibe 403 (`ACCOUNT_SUSPENDED`) en toda operación salvo
  la exportación de sus datos; sus viviendas dejan de aparecer en el
  descubrimiento y no forma matches nuevos; sus matches abiertos se cierran.
- La app muestra una pantalla de cuenta suspendida con el motivo general y cómo
  contactar.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `moderation`: suspensión de usuarios.

## Impact

- `services/api`: columnas de suspensión, comprobación en el punto central de
  autorización, cierre de matches, ruta y fila de la matriz.
- `apps/mobile`: pantalla de cuenta suspendida y acción en «Administración».

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
| Suspender y reactivar usuarios | nuevo | 3 | P2 |
| Efecto de la suspensión | nuevo | 3 | P2 |

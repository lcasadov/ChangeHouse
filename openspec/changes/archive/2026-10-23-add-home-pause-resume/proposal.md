# Proposal

## Why

Un propietario puede necesitar dejar de aparecer unos días sin perder su ficha,
sus me gusta ni sus matches. Pausar y reactivar es más sencillo y más seguro
que borrar (RF-17).

## What Changes

- Pausar una vivienda publicada (`pauseHome`) y reactivarla (`resumeHome`).
- Una vivienda pausada no aparece en el descubrimiento ni forma matches nuevos,
  pero conserva sus matches abiertos y su propietario sigue siendo `owner`.
- Editar datos relevantes (valor, fotos, características) de una vivienda
  publicada o pausada la devuelve a revisión.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `homes`: pausa, reactivación y vuelta a revisión tras cambios relevantes.

## Impact

- `services/api`: transiciones `published ↔ paused` y `→ in_review`, rutas y
  filas de la matriz.
- `apps/mobile`: acciones en «Mis casas» y en el detalle propio.

**Capacidad principal**: `homes`

## Trazabilidad

| Nivel | Decisión | Motivo |
|---|---|---|
| Epic | existente | Epic de `homes` |
| Feature | nuevo | Change nuevo |
| Story | nuevo | Una por requisito del spec delta |
| Task | nuevo | Una por línea de `tasks.md` |

| Requirement | Decisión | Story Points | Prioridad |
|---|---|---|---|
| Pausar y reactivar | nuevo | 2 | P2 |
| Vuelta a revisión tras cambios relevantes | nuevo | 2 | P2 |

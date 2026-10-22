# Proposal

## Why

Tras el match, los participantes necesitan conocer de verdad las viviendas
—dirección exacta, todas las fotos, quién es el otro— y decidir si siguen
adelante. Es el cierre del primer recorrido de principio a fin (RF-53 a RF-56,
RN-08, RN-10).

## What Changes

- Detalle del match (`getMatch`) solo para sus participantes (y `admin`):
  viviendas con fotos completas, dirección postal exacta de cada vivienda que
  se entrega, nombre visible de cada participante y compensación de cada uno.
- Compartir el teléfono por match, solo si el participante lo autoriza
  (`setPhoneSharing`).
- Confirmar interés (`confirmMatch`): cuando todos confirman, el match pasa a
  `confirmed` (en el MVP no se pausan los demás matches de esas viviendas).
- Retirarse (`withdrawFromMatch`): el match se cierra para todos.
- Fuera de alcance: chat, notificaciones, operación con gestoría.

## Capabilities

### New Capabilities

- `matches`: ciclo de vida de un match una vez creado y lo que ve cada
  participante.

### Modified Capabilities

Ninguna.

## Impact

- `services/api`: casos de uso y rutas de detalle y decisiones, columna
  `shares_phone`, transiciones de estado del match y del participante,
  descifrado de direcciones solo para participantes, filas de la matriz.
- `apps/mobile`: pantalla de detalle del match con las acciones.

**Capacidad principal**: `matches`

## Trazabilidad

| Nivel | Decisión | Motivo |
|---|---|---|
| Epic | nuevo | No existe `cap:matches` |
| Feature | nuevo | Change nuevo |
| Story | nuevo | Una por requisito del spec delta |
| Task | nuevo | Una por línea de `tasks.md` |

| Requirement | Decisión | Story Points | Prioridad |
|---|---|---|---|
| Detalle del match para sus participantes | nuevo | 5 | P1 |
| Teléfono solo con autorización | nuevo | 2 | P1 |
| Confirmar interés | nuevo | 3 | P1 |
| Retirarse cierra el match para todos | nuevo | 3 | P1 |

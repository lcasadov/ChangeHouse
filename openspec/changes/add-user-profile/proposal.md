# Proposal

## Why

Para emparejar viviendas y simular la operación, ChangeHouse necesita saber el
municipio del usuario, si cumple los requisitos de acceso a VPP y si es mayor
de 65, y los participantes de un match necesitan un nombre visible y, si el
usuario lo autoriza, un teléfono (RF-03, RF-33, RF-71).

## What Changes

- Pestaña «Perfil» con la ficha del usuario y su edición: nombre visible,
  municipio, teléfono (privado), requisitos VPP y mayor de 65.
- Edición mediante la operación existente `upsertMe`; el teléfono se valida en
  formato internacional y nunca se muestra a terceros en este change.
- Cerrar sesión desde el perfil.
- Fuera de alcance: foto de perfil propia (se usa la del proveedor si existe),
  borrado y exportación de la cuenta, preferencias de notificación.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `accounts`: se añade la edición del perfil del usuario.

## Impact

- `apps/mobile`: pantalla de perfil y formulario de edición (React Hook Form +
  Zod compartido).
- `services/api`: validación de los campos de perfil en `upsertMe`.
- `packages/shared`: esquema de perfil.

**Capacidad principal**: `accounts`

## Trazabilidad

| Nivel | Decisión | Motivo |
|---|---|---|
| Epic | existente | Epic de la capacidad `accounts`, creada por `add-authentication` |
| Feature | nuevo | Change nuevo |
| Story | nuevo | Una por requisito del spec delta |
| Task | nuevo | Una por línea de `tasks.md` |

| Requirement | Decisión | Story Points | Prioridad |
|---|---|---|---|
| Edición del perfil | nuevo | 3 | P1 |
| Privacidad del teléfono | nuevo | 2 | P1 |

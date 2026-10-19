# Proposal

## Why

Ninguna vivienda se publica sin revisión previa: es la primera defensa contra
anuncios falsos o inadecuados, y es requisito para que haya algo que descubrir
(RF-18, RF-90, RF-93).

## What Changes

- Cola de moderación en la sección de administración de la app (web y móvil),
  visible solo para el rol `admin`: viviendas en `in_review` por antigüedad
  (`adminListHomes`).
- Aprobar (pasa a `published`) o rechazar con motivo (vuelve a `draft` con el
  motivo visible para el propietario) (`adminModerateHome`).
- Registro de auditoría de cada decisión (tabla `audit_log`), de solo inserción.
- Script de servidor para asignar el rol `admin` a un usuario existente.
- Fuera de alcance: denuncias, suspensiones y panel de métricas.

## Capabilities

### New Capabilities

- `moderation`: revisión de contenidos y cuentas por el equipo de ChangeHouse.

### Modified Capabilities

Ninguna.

## Impact

- `services/api`: tabla `audit_log`, puerto `AuditLog`, casos de uso y rutas de
  moderación, filas de la matriz, script `admin:grant`.
- `apps/mobile`: sección «Administración» condicionada al rol, cola y
  detalle de moderación; en «Mis casas», el motivo del rechazo.

**Capacidad principal**: `moderation`

## Trazabilidad

| Nivel | Decisión | Motivo |
|---|---|---|
| Epic | nuevo | No existe `cap:moderation` |
| Feature | nuevo | Change nuevo |
| Story | nuevo | Una por requisito del spec delta |
| Task | nuevo | Una por línea de `tasks.md` |

| Requirement | Decisión | Story Points | Prioridad |
|---|---|---|---|
| Cola de moderación de viviendas | nuevo | 3 | P1 |
| Aprobación y rechazo con motivo | nuevo | 3 | P1 |
| Registro de auditoría de la moderación | nuevo | 2 | P1 |

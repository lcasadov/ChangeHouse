# Proposal

## Why

El equipo necesita ver la salud del producto —altas, viviendas por zona, likes,
matches directos y en cadena— y gestionar usuarios y la lista de espera desde un
solo sitio, con trazabilidad de lo que hace (RF-90, RF-91, RF-93, RF-101).

## What Changes

- Panel de métricas por periodo (`adminGetMetrics`): altas, viviendas publicadas
  por barrio o zona, me gusta, matches directos y en cadena, operaciones.
- Listado y búsqueda de usuarios (`adminListUsers`) con acceso a suspender.
- Consulta del registro de auditoría (`adminListAuditLog`).
- Consulta y exportación CSV de la lista de espera (`adminListWaitlist`).
- Todo en la sección «Administración», optimizada para web ancha (tablas que
  pasan a tarjetas en pantallas estrechas).

## Capabilities

### New Capabilities

- `admin`: herramientas del equipo de ChangeHouse para seguir el producto.

### Modified Capabilities

Ninguna.

## Impact

- `services/api`: consultas agregadas, rutas y filas de la matriz.
- `apps/mobile`: panel, tablas de usuarios, auditoría y lista de espera.

**Capacidad principal**: `admin`

## Trazabilidad

| Nivel | Decisión | Motivo |
|---|---|---|
| Epic | nuevo | No existe `cap:admin` |
| Feature | nuevo | Change nuevo |
| Story | nuevo | Una por requisito del spec delta |
| Task | nuevo | Una por línea de `tasks.md` |

| Requirement | Decisión | Story Points | Prioridad |
|---|---|---|---|
| Métricas del producto | nuevo | 5 | P2 |
| Gestión de usuarios | nuevo | 3 | P2 |
| Consulta de la auditoría | nuevo | 2 | P2 |
| Lista de espera para el equipo | nuevo | 2 | P2 |

# Proposal

## Why

El RGPD reconoce los derechos de supresión y portabilidad, y las tiendas de
aplicaciones exigen poder eliminar la cuenta desde la propia app. Sin esto no se
puede publicar (RF-05, RNF-13).

## What Changes

- Eliminar la cuenta desde «Perfil» (`deleteMe`) con doble confirmación: borrado
  lógico y anonimización de email, nombre y teléfono, viviendas a `closed`,
  matches abiertos cerrados para todos, dispositivos y preferencias borrados, y
  baja en Firebase Auth. Se conservan consentimientos y auditoría como evidencia.
- Exportar los datos personales en JSON (`exportMyData`): cuenta, viviendas,
  preferencias, me gusta, descartes, matches y consentimientos (sin datos de
  otros usuarios).

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `accounts`: supresión y portabilidad de los datos.

## Impact

- `services/api`: casos de uso transaccionales de borrado y exportación, rutas y
  filas de la matriz, baja en Firebase Auth mediante el puerto de identidad.
- `apps/mobile`: acciones en «Perfil» y compartir el fichero exportado.

**Capacidad principal**: `accounts`

## Trazabilidad

| Nivel | Decisión | Motivo |
|---|---|---|
| Epic | existente | Epic de `accounts` |
| Feature | nuevo | Change nuevo |
| Story | nuevo | Una por requisito del spec delta |
| Task | nuevo | Una por línea de `tasks.md` |

| Requirement | Decisión | Story Points | Prioridad |
|---|---|---|---|
| Eliminar la cuenta | nuevo | 5 | P1 |
| Exportar mis datos | nuevo | 3 | P1 |

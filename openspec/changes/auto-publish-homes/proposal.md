# Proposal

## Why

Hoy toda vivienda espera a que un administrador la apruebe antes de verse. Al
probar la app, el usuario pidió que la publicación sea automática y que la
revisión ocurra «solo bajo denuncia»: con pocos administradores, la cola frena
la llegada de casas y, con ello, los matches.

## What Changes

- Enviar una vivienda completa (datos obligatorios y 3 fotos procesadas) la
  **publica al momento**, sin pasar por la cola. La excepción es una vivienda
  rechazada antes por un administrador: al reenviarla vuelve a revisión.
- **Denunciar una vivienda la retira**: si está publicada o pausada, pasa a
  `in_review`, deja de aparecer en Explorar y entra en la cola de moderación. La
  denuncia y la retirada se guardan juntas, con entrada de auditoría.
- La moderación sigue igual: aprobar la vuelve a publicar y rechazar la devuelve a
  borrador con el motivo.
- Editar valor, fotos, características o régimen de una vivienda publicada **ya
  no** la devuelve a revisión. Sigue anotando el cambio relevante que reactiva
  sus descartes. La app deja de avisar de que volverá a revisión.
- Textos de la app: «Publicar» en lugar de «Enviar a revisión» y una nota nueva
  para una casa retirada.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `homes`: el envío publica y los cambios relevantes no devuelven a revisión.
- `moderation`: la cola recoge las viviendas retiradas por denuncia, y denunciar
  una vivienda la retira.

## Impact

- `services/api`:
  - Dominio `home` (`submitHome`, `relevantChangeOf`, nueva `retireReportedHome`).
  - `report-operations` (denuncia y retirada en una transacción).
  - `AuditAction` `home.report_retire`.
  - Pruebas de dominio, aplicación e integración.
- `apps/mobile`:
  - `SubmitAction`, `HomeWizard` (sin aviso de nueva revisión), textos `es-ES` y
    el doble de pruebas `fake-homes`.
  - Pruebas de flujo.
- `docs/api/openapi.yaml` (descripción de `submit` y de denunciar) y
  `docs/desarrollo-local.md`.
- Sin migración: `audit_log.action` es texto libre y los estados no cambian.

**Capacidad principal**: `moderation`

## Trazabilidad

| Nivel | Decisión | Motivo |
|---|---|---|
| Epic | existente #125 | Capacidad principal `moderation`; relacionada: `homes` #92 |
| Feature | existente #425 | Issue de la petición ya creado; pasa a ser la Feature del change |
| Story | nuevo | Una por requisito añadido o modificado del spec delta |
| Task | nuevo | Una por línea de `tasks.md` |

| Requirement | Decisión | Story Points | Prioridad |
|---|---|---|---|
| Publicación al enviar | nuevo | 3 | P1 |
| Cambios relevantes sin nueva revisión | nuevo | 2 | P1 |
| Cola de moderación de viviendas | nuevo | 1 | P1 |
| Denunciar | nuevo | 3 | P1 |

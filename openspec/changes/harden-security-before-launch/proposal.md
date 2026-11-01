# Proposal

## Why

La auditoría de seguridad del MVP (2026-10-31) encontró un hallazgo de severidad
alta que bloquea el primer despliegue con usuarios reales. Tras cerrarse un match
o borrarse una cuenta, sus participantes siguen viendo indefinidamente la
dirección exacta y el teléfono de los demás, y el consentimiento para compartirlos
no se puede revocar (RGPD art. 7.3 y 17). Encontró además ocho de severidad media:
subidas sin límite, procesado de imágenes que puede agotar la memoria, un bloqueo
que no corta el chat, la web sin CSP, reglas que no se despliegan en PROD,
inyección en el workflow de despliegue, un teléfono imposible de borrar y la
retención de datos sin aplicar. Hay que resolverlos antes de publicar.

## What Changes

- **Matches**: la dirección exacta y los teléfonos se entregan solo mientras el
  match está `open` o `confirmed`. Al cerrarse, la autorización para compartir el
  teléfono se retira para todos, y cada participante puede retirar la suya en
  cualquier estado.
- **Cuentas**:
  - El usuario puede borrar su teléfono.
  - Al eliminar la cuenta se borran también la dirección y la ubicación exactas
    de sus viviendas.
  - Un usuario suspendido puede eliminar su cuenta.
- **Moderación**: bloquear a un usuario cierra los matches activos entre los dos
  (y con ello su chat), sin avisar por push a quien bloqueó.
- **Viviendas y chat**: las URL firmadas limitan el tamaño (25 MB) y hay límites
  de fotos pendientes por vivienda y de imágenes del chat por usuario y hora.
  Además, el procesado limita los píxeles (40 MP) y la concurrencia.
- **Retención**: los mensajes del chat se purgan a los 12 meses del cierre del
  match, y la lista de espera a los 12 meses del lanzamiento. Cada purga se
  registra en la auditoría.
- **Plataforma** (nueva capacidad `platform-security`):
  - Cabeceras CSP y antiincrustación en la web.
  - Reglas de Firestore y Storage desplegadas en todos los entornos.
  - Buckets con ciclo de vida y lectura pública sin listado creados por script.
  - Orígenes CORS obligatorios en Cloud Run.
  - Registros sin datos personales.
  - Workflow de despliegue sin inyección y con acciones fijadas por SHA.

Quedan fuera, con issue propio:
- límites de tasa compartidos entre instancias (B1);
- comprobación de tokens revocados (B3);
- email verificado en el alta (B5);
- auditoría de lecturas de admin (B6);
- permisos IAM acotados (B8).

## Capabilities

### New Capabilities

- `platform-security`: protecciones transversales de la plataforma, es decir,
  cabeceras web, despliegue de reglas, configuración obligatoria, buckets y
  registros sin datos personales.

### Modified Capabilities

- `matches`: el detalle entrega dirección y teléfono solo en matches activos; la
  autorización del teléfono se puede retirar en cualquier estado y se retira al
  cerrar.
- `accounts`: borrar el teléfono; la eliminación de la cuenta borra la dirección
  y la ubicación exactas.
- `moderation`: el bloqueo cierra los matches activos entre ambos; el usuario
  suspendido puede eliminar su cuenta.
- `homes`: límites de tamaño, de fotos pendientes y de píxeles en las fotos.
- `chat`: límite de imágenes por usuario y hora y purga de mensajes a los 12
  meses.
- `waitlist`: purga a los 12 meses del lanzamiento.

## Impact

- `services/api`:
  - Matching, cuentas, moderación, fotos, chat e imágenes.
  - Configuración y logger.
  - Una tarea programada de purga.
  - Nueva fila de la matriz para `deleteMe` del suspendido.
- `packages/shared`: el esquema de cuenta acepta `phone: null`.
- `apps/mobile`: borrar el teléfono en el perfil, el match cerrado sin dirección
  ni teléfono y la pantalla de suspensión con «Eliminar mi cuenta».
- `firebase.json`, `.github/workflows/deploy.yml`, `services/api/Dockerfile` y
  `.dockerignore`, `infra/gcp`.
- `docs/api/openapi.yaml`, `docs/rbac-matrix.md` y `docs/project.md`
  (variables de retención y de la fecha de lanzamiento).

**Capacidad principal**: `matches`

## Trazabilidad

| Nivel | Decisión | Motivo |
|---|---|---|
| Epic | existente #197 | Capacidad principal `matches` (se reabre); relacionadas: `accounts` #59, `moderation` #125, `homes` #92, `chat` #232, `waitlist` #38 y la nueva `platform-security` |
| Feature | existente #346 | Issue del endurecimiento ya creado; pasa a ser la Feature del change |
| Story | nuevo | Una por requisito del spec delta |
| Task | nuevo | Una por línea de `tasks.md` |

| Requirement | Decisión | Story Points | Prioridad |
|---|---|---|---|
| Detalle del match para sus participantes | nuevo | 3 | P1 |
| Teléfono solo con autorización | nuevo | 2 | P1 |
| Borrar el teléfono | nuevo | 1 | P2 |
| Eliminar la cuenta | nuevo | 2 | P1 |
| Bloquear a un usuario | nuevo | 3 | P2 |
| Efecto de la suspensión | nuevo | 1 | P2 |
| Límites de las subidas de fotos | nuevo | 3 | P2 |
| Límite de imágenes del chat | nuevo | 2 | P2 |
| Retención del chat | nuevo | 3 | P2 |
| Retención de la lista de espera | nuevo | 2 | P3 |
| Cabeceras de seguridad de la web | nuevo | 2 | P2 |
| Reglas y almacenamiento desplegados en todos los entornos | nuevo | 3 | P1 |
| Configuración y registros seguros | nuevo | 2 | P2 |
| Despliegue sin inyección | nuevo | 2 | P2 |

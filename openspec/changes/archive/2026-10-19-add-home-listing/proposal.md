# Proposal

## Why

Sin viviendas publicadas no hay descubrimiento ni matches: la ficha de vivienda
es la base del producto. Debe poder rellenarse en pocos minutos, guardar el
avance y dejar al propietario elegir cuánto revela de su ubicación (RF-10,
RF-12, RF-13, RF-15, RF-16, RF-17, RF-20).

## What Changes

- Alta de vivienda en borrador con un asistente de pasos (tipo y dirección,
  características, valor y cargas, ubicación visible, revisión) que guarda el
  avance en cada paso (`createHome`, `updateHome`).
- Varias viviendas por usuario, listadas en la pestaña «Mis casas»
  (`listMyHomes`); cada una con su estado.
- Dirección con autocompletado y resolución en el servidor del punto exacto, el
  barrio o zona y su centro; el propietario elige mostrar la ubicación exacta o
  solo el barrio o zona; la dirección postal nunca se publica y se guarda
  cifrada.
- Detalle de vivienda (`getHome`) en forma completa para su propietario y
  pública para los demás solo si está publicada.
- Envío a revisión (`submitHome`) cuando la ficha está completa.
- El rol `owner` pasa a derivarse de tener alguna vivienda publicada, pausada o
  en operación.
- Fuera de alcance: fotos (`add-home-photos`), moderación
  (`add-home-moderation`), reglas propias de VPP (`add-home-vpp-regime`),
  pausar y reactivar (`add-home-pause-resume`).

## Capabilities

### New Capabilities

- `homes`: fichas de vivienda, su ciclo de estados y la visibilidad de su
  ubicación.

### Modified Capabilities

Ninguna. La derivación del rol `owner` se especifica en `homes` y sustituye la implementación provisional del puerto `HomeOwnership` de `add-authentication`.

## Impact

- `services/api`: tabla `homes` (PostGIS, dirección cifrada), puerto
  `PlaceResolver` con adaptador de Google Places y adaptador de pruebas,
  casos de uso y rutas de viviendas, filas nuevas en la matriz.
- `apps/mobile`: pestaña «Mis casas», asistente de alta y detalle.
- `packages/shared`: esquemas `HomeInput`, `HomePatch`, listas cerradas.
- Secretos: clave de cifrado de direcciones y clave de Google Places (Secret
  Manager en DES/PROD; variables locales en desarrollo).

**Capacidad principal**: `homes`

## Trazabilidad

| Nivel | Decisión | Motivo |
|---|---|---|
| Epic | nuevo | No existe `cap:homes` |
| Feature | nuevo | Change nuevo |
| Story | nuevo | Una por requisito del spec delta |
| Task | nuevo | Una por línea de `tasks.md` |

| Requirement | Decisión | Story Points | Prioridad |
|---|---|---|---|
| Alta de vivienda en borrador | nuevo | 8 | P1 |
| Varias viviendas por usuario | nuevo | 3 | P2 |
| Ubicación y dirección privada | nuevo | 5 | P1 |
| Detalle de vivienda según quién la consulta | nuevo | 3 | P1 |
| Envío a revisión | nuevo | 2 | P1 |
| Rol de propietario derivado de sus viviendas | nuevo | 2 | P1 |

# Proposal

## Why

Decidir tiene que costar un gesto: deslizar o pulsar «Me gusta» o
«Descartar», y poder deshacer un error al instante. El «me gusta» es además la
arista del grafo que alimenta el matching (RF-41, RF-44, RF-45, RN-01, RN-02).

## What Changes

- «Me gusta» desde una vivienda propia publicada (`likeHome` con
  `fromHomeId`), con un límite de 10 al día por usuario, configurable por
  entorno.
- «Descartar» (`dismissHome`), que oculta la vivienda desde esa vivienda hasta
  que cambie de forma relevante.
- «Deshacer» la última acción (`undoLastAction`), visible 5 segundos tras cada
  decisión.
- Gesto de deslizar (derecha: me gusta; izquierda: descartar) con botones
  equivalentes siempre visibles (alternativa sin gestos, WCAG 2.5.1), háptica y
  animación que respeta «reducir movimiento».
- Un `seeker` puede descartar pero no dar me gusta: al intentarlo se le invita a
  publicar su vivienda.
- Fuera de alcance: la detección de matches al dar me gusta (`add-direct-match`).

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `discovery`: se añaden las decisiones sobre las tarjetas.

## Impact

- `services/api`: tablas `likes` y `dismissals` con índices, casos de uso y
  rutas, límite diario, filas de la matriz.
- `apps/mobile`: gestos y botones en la pila de tarjetas, barra de deshacer,
  háptica (`expo-haptics`).

**Capacidad principal**: `discovery`

## Trazabilidad

| Nivel | Decisión | Motivo |
|---|---|---|
| Epic | existente | Epic de `discovery`, creada por `add-discovery-feed` |
| Feature | nuevo | Change nuevo |
| Story | nuevo | Una por requisito del spec delta |
| Task | nuevo | Una por línea de `tasks.md` |

| Requirement | Decisión | Story Points | Prioridad |
|---|---|---|---|
| Me gusta desde una vivienda propia | nuevo | 3 | P1 |
| Límite diario de me gusta | nuevo | 2 | P1 |
| Descartar | nuevo | 2 | P1 |
| Deshacer la última acción | nuevo | 2 | P2 |
| Decidir con un gesto | nuevo | 5 | P1 |

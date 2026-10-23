# Proposal

## Why

Los propietarios de vivienda protegida (VPPB, VPPL, VPO) son un segmento
prioritario, pero su vivienda tiene un precio máximo legal y solo puede
transmitirse a quien cumple los requisitos de acceso. Publicarlas sin esas
reglas expondría a los usuarios a operaciones nulas (RF-14, RF-73, RN-06).

## What Changes

- Paso de régimen en el alta: libre, VPPB, VPPL o VPO; para VPP, fecha de
  calificación definitiva (obligatoria), fin del plazo de protección y precio
  máximo legal si se conoce.
- El valor máximo declarado de una VPP no puede superar su precio máximo legal.
- Aviso informativo en la ficha y el detalle de una VPP: precio máximo,
  necesidad de visado o autorización y requisitos del adquirente; el tanteo y
  retracto en permutas figura como «pendiente de confirmar».
- La regla de visibilidad (solo a quien declara cumplir los requisitos) ya la
  aplica el descubrimiento.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `homes`: régimen de protección de la vivienda y sus límites.

## Impact

- `services/api`: validaciones de régimen en dominio y esquema (restricciones
  `CHECK` ya previstas en el modelo).
- `apps/mobile`: paso de régimen en el asistente y aviso informativo.

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
| Régimen de protección | nuevo | 3 | P2 |
| Precio máximo legal | nuevo | 2 | P2 |
| Aviso informativo de vivienda protegida | nuevo | 2 | P3 |

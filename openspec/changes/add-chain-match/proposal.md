# Proposal

## Why

Las cadenas de tres (A quiere B, B quiere C, C quiere A) multiplican las
posibilidades frente al intercambio directo y son la ventaja competitiva de
ChangeHouse (RF-51, RN-05; objetivo: ≥ 15 % de matches en cadena).

## What Changes

- Detección de **matches en cadena** de tres viviendas en la misma transacción
  que el «Me gusta», con las mismas reglas de publicación y compatibilidad
  económica para los tres participantes y la longitud máxima de 3.
- Rendimiento: detección en menos de 1 s con 50.000 viviendas (RNF-20).
- La celebración, la lista y el detalle muestran las tres viviendas (animación
  en triángulo).
- Fuera de alcance: cadenas de más de tres viviendas.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `matching`: se añade el match en cadena de tres y su presentación (el detalle y las decisiones de `matches` ya admiten de 2 a 3 participantes).

## Impact

- `services/api`: consulta de ciclos de longitud 3 en `CycleCandidates`,
  índices, prueba de rendimiento.
- `apps/mobile`: celebración en triángulo y presentación de tres viviendas.

**Capacidad principal**: `matching`

## Trazabilidad

| Nivel | Decisión | Motivo |
|---|---|---|
| Epic | existente | Epic de `matching`, creada por `add-direct-match` |
| Feature | nuevo | Change nuevo |
| Story | nuevo | Una por requisito del spec delta |
| Task | nuevo | Una por línea de `tasks.md` |

| Requirement | Decisión | Story Points | Prioridad |
|---|---|---|---|
| Match en cadena de tres | nuevo | 8 | P1 |
| Rendimiento de la detección | nuevo | 3 | P1 |
| Presentación de la cadena | nuevo | 3 | P2 |

# Proposal

## Why

El match es la promesa del producto: dos propietarios que se quieren mutuamente
la casa y pueden asumir la diferencia de valor. Es también el mayor riesgo
técnico —compatibilidad económica en los dos sentidos y concurrencia— y debe
validarse cuanto antes (RF-50, RF-52, RF-56, RN-02 a RN-04).

## What Changes

- Detección del **match directo** (ciclo de 2) en la misma transacción que el
  «Me gusta»: si la otra vivienda ya había dado me gusta a la mía, ambas están
  publicadas y la compensación es aceptable para los dos, se crea el match con
  la compensación de cada participante y `likeHome` lo devuelve.
- Sin duplicados: clave canónica del ciclo única; dos me gusta simultáneos
  crean un único match.
- Pestaña «Matches» con la lista de matches del usuario (`listMyMatches`).
- Celebración de pantalla completa al hacer match (las dos casas se
  intercambian) con acceso directo al match.
- Fuera de alcance: cadenas de tres (`add-chain-match`), detalle, confirmar y
  retirarse (`add-match-details-and-decisions`), chat y notificaciones.

## Capabilities

### New Capabilities

- `matching`: detección de matches entre viviendas y su compatibilidad
  económica.

### Modified Capabilities

Ninguna.

## Impact

- `services/api`: tablas `matches` y `match_participants`, detector de ciclos
  (consulta en el adaptador, reglas en el dominio), transacción con el me gusta,
  ruta `listMyMatches`, filas de la matriz.
- `apps/mobile`: celebración del match y pestaña «Matches».

**Capacidad principal**: `matching`

## Trazabilidad

| Nivel | Decisión | Motivo |
|---|---|---|
| Epic | nuevo | No existe `cap:matching` |
| Feature | nuevo | Change nuevo |
| Story | nuevo | Una por requisito del spec delta |
| Task | nuevo | Una por línea de `tasks.md` |

| Requirement | Decisión | Story Points | Prioridad |
|---|---|---|---|
| Match directo | nuevo | 8 | P1 |
| Un solo match por ciclo | nuevo | 5 | P1 |
| Compensaciones del match | nuevo | 3 | P1 |
| Lista de matches | nuevo | 3 | P1 |
| Celebración del match | nuevo | 3 | P2 |

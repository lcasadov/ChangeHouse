# Proposal

## Why

Para enseñar solo viviendas que encajan —y que además pueden querer la del
usuario— hace falta saber dónde quiere vivir, qué necesita y cuánto puede
compensar. Es el paso que convierte «buscar» en «escribir un sitio y ajustar
dos o tres filtros» (RF-30 a RF-33, RN-03).

## What Changes

- Preferencias por defecto del usuario (`getMySearchPreferences`,
  `putMySearchPreferences`) y, opcionalmente, propias de cada vivienda
  (`getHomeSearchPreferences`, `putHomeSearchPreferences`,
  `deleteHomeSearchPreferences`), que sustituyen a las del usuario al buscar
  desde esa vivienda.
- Contenido: zonas (municipios o un punto con radio), filtros (tipos,
  superficie útil mínima, dormitorios, baños, garaje, ascensor, exterior),
  máximo a pagar, mínimo a recibir y el punto del rango de valor que se usa
  para compensar (por defecto el medio).
- Experiencia: barra «¿Dónde quieres vivir?» con autocompletado, chips de
  filtro de un toque y una hoja inferior con el resto; forma parte del primer
  uso («¿Dónde quieres vivir y cuánto puedes compensar?») y se edita desde
  «Explorar».

## Capabilities

### New Capabilities

- `search-preferences`: qué busca cada usuario y desde cada vivienda, y cuánto
  está dispuesto a compensar.

### Modified Capabilities

Ninguna.

## Impact

- `services/api`: tabla `search_preferences` (por usuario o por vivienda,
  PostGIS), casos de uso, rutas y filas de la matriz.
- `apps/mobile`: barra de búsqueda, chips, hoja de filtros, paso del primer uso.
- `packages/shared`: esquema `SearchPreferences`.

**Capacidad principal**: `search-preferences`

## Trazabilidad

| Nivel | Decisión | Motivo |
|---|---|---|
| Epic | nuevo | No existe `cap:search-preferences` |
| Feature | nuevo | Change nuevo |
| Story | nuevo | Una por requisito del spec delta |
| Task | nuevo | Una por línea de `tasks.md` |

| Requirement | Decisión | Story Points | Prioridad |
|---|---|---|---|
| Preferencias por defecto del usuario | nuevo | 3 | P1 |
| Preferencias propias de una vivienda | nuevo | 3 | P2 |
| Búsqueda en un toque | nuevo | 5 | P1 |

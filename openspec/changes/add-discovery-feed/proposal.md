# Proposal

## Why

El momento clave de ChangeHouse es abrir «Explorar» y ver, sin buscar a mano,
viviendas que te gustan **y** cuyos dueños podrían querer la tuya, con el coste
del cambio a la vista. Es lo que diferencia la permuta asistida de un tablón de
anuncios (RF-40, RF-44, RN-06, RN-11).

## What Changes

- Tarjetas de descubrimiento (`discoverHomes`) desde una vivienda propia
  publicada: viviendas publicadas que cumplen las preferencias efectivas de esa
  vivienda, cuya ubicación y características encajan con las preferencias de su
  dueño, y con compatibilidad económica en los dos sentidos.
- Píldora de compensación en cada tarjeta: «Tú recibes X €», «Tú pagas X €» o
  «Cambio justo», calculada con el punto de referencia del rango de cada
  propietario.
- Exclusiones: viviendas propias, no publicadas (incluidas las que están en
  operación), descartadas (salvo cambio relevante posterior) y VPP para quien
  no declara cumplir los requisitos.
- Un usuario sin vivienda publicada (`seeker`) ve las viviendas que cumplen sus
  preferencias, sin compatibilidad inversa ni compensación.
- Tarjeta a pantalla completa con carrusel de fotos y detalle al tocarla.
- Fuera de alcance: me gusta, descartar y deshacer (`add-like-dismiss-undo`);
  vista de lista y mapa (fase 2).

## Capabilities

### New Capabilities

- `discovery`: qué viviendas se proponen a cada usuario y cómo se presentan.

### Modified Capabilities

Ninguna.

## Impact

- `services/api`: consulta de descubrimiento con PostGIS e índices, cálculo de
  compensación en el dominio, ruta `discoverHomes` y su fila en la matriz.
- `apps/mobile`: pestaña «Explorar» con la pila de tarjetas, selector de
  vivienda desde la que se busca y detalle.

**Capacidad principal**: `discovery`

## Trazabilidad

| Nivel | Decisión | Motivo |
|---|---|---|
| Epic | nuevo | No existe `cap:discovery` |
| Feature | nuevo | Change nuevo |
| Story | nuevo | Una por requisito del spec delta |
| Task | nuevo | Una por línea de `tasks.md` |

| Requirement | Decisión | Story Points | Prioridad |
|---|---|---|---|
| Viviendas compatibles en los dos sentidos | nuevo | 8 | P1 |
| Compensación visible en cada tarjeta | nuevo | 3 | P1 |
| Viviendas excluidas | nuevo | 3 | P1 |
| Descubrimiento sin vivienda publicada | nuevo | 2 | P2 |
| Tarjetas a pantalla completa | nuevo | 5 | P1 |

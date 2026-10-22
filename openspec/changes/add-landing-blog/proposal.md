# Proposal

## Why

La permuta es poco conocida: guías claras sobre cómo funciona, la vivienda
protegida y los impuestos atraen tráfico orgánico y resuelven dudas antes del
registro (RF-102).

## What Changes

- Blog estático en la landing (`/guias`) con artículos en Markdown
  (colecciones de contenido de Astro): listado, artículo con índice, fecha y
  tiempo de lectura, y enlaces a la lista de espera.
- Tres guías iniciales en borrador: qué es una permuta y cómo funciona en
  ChangeHouse, cadenas de tres, y nociones fiscales orientativas (sin
  recomendar valores de escritura, RN-07).
- SEO por artículo (metadatos, datos estructurados `Article`) y feed RSS.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `landing`: guías y artículos.

## Impact

- `apps/landing`: colección `guias`, plantillas de listado y artículo, RSS.

**Capacidad principal**: `landing`

## Trazabilidad

| Nivel | Decisión | Motivo |
|---|---|---|
| Epic | existente | Epic de `landing` |
| Feature | nuevo | Change nuevo |
| Story | nuevo | Una por requisito del spec delta |
| Task | nuevo | Una por línea de `tasks.md` |

| Requirement | Decisión | Story Points | Prioridad |
|---|---|---|---|
| Guías publicadas | nuevo | 3 | P3 |
| Guías encontrables | nuevo | 2 | P3 |

# Proposal

## Why

La fase 0 del producto valida la demanda **antes** de construir la app: hace
falta una web pública que explique en segundos qué es ChangeHouse y por qué
interesa, y que cumpla la LSSI y el RGPD desde el primer visitante (README §3,
RF-100, RF-103).

## What Changes

- Landing pública en `apps/landing` con: héroe con la promesa «Cambia de casa
  sin vender primero», «Cómo funciona» en tres pasos, explicación de las cadenas
  de tres, ventajas (sin agencia, sin quedarse sin casa, menos hipoteca),
  historia del fundador y preguntas frecuentes.
- Páginas legales: aviso legal, privacidad, cookies y términos, enlazadas desde
  el pie de todas las páginas.
- Gestión del consentimiento de cookies: ninguna cookie ni almacenamiento no
  esencial antes de consentir; aceptar, rechazar o configurar con el mismo
  esfuerzo.
- SEO básico: título, descripción y Open Graph por página, `sitemap.xml` y
  `robots.txt`.
- El formulario de lista de espera **no** entra aquí: lo trae `add-waitlist`.

## Capabilities

### New Capabilities

- `landing`: web pública de ChangeHouse — propuesta de valor, contenido
  informativo, páginas legales, consentimiento de cookies y SEO.

### Modified Capabilities

Ninguna.

## Impact

- Código: `apps/landing` (páginas, componentes, contenidos en `src/i18n/es.ts`).
- Sin cambios en la API ni en la base de datos.
- Dependencias: integración de sitemap de Astro.
- Contenido: los textos legales y la historia del fundador se publican como
  borrador marcado «pendiente de revisión» hasta que el negocio y el abogado
  los validen.

**Capacidad principal**: `landing`

## Trazabilidad

| Nivel | Decisión | Motivo |
|---|---|---|
| Epic | nuevo | No existe ningún elemento con la etiqueta `cap:landing` |
| Feature | nuevo | Change nuevo |
| Story | nuevo | Una por requisito del spec delta |
| Task | nuevo | Una por línea de `tasks.md` |

| Requirement | Decisión | Story Points | Prioridad |
|---|---|---|---|
| Presentación de la propuesta de valor | nuevo | 5 | P1 |
| Páginas legales | nuevo | 2 | P1 |
| Consentimiento de cookies | nuevo | 3 | P1 |
| Accesibilidad, temas y adaptación a pantalla | nuevo | 3 | P2 |
| Descubrimiento en buscadores | nuevo | 2 | P3 |

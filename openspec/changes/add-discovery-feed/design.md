# Design

## Context

Existen viviendas con ubicación PostGIS y estados (`homes`), moderación y
preferencias efectivas por vivienda (`search-preferences`). Objetivo de
rendimiento: p95 < 300 ms en lecturas (RNF-20). Motivación en `proposal.md`.

## Decisions

- **Valor de referencia** de una vivienda = `min + pct · (max − min)` con el
  `value_reference_pct` de las preferencias efectivas de su dueño (por defecto
  50). Compensación del usuario = valor de la candidata − valor de la suya.
  Función pura del dominio (`domain/matching/compensation.ts`), reutilizada por
  el matching. «Cambio justo» cuando |diferencia| ≤ 1 % del mayor de los dos
  valores (decisión de presentación; el cálculo exacto se conserva).
- **Consulta en dos fases**: (1) SQL con PostGIS filtra candidatas publicadas
  por zona (`ST_DWithin` / municipio), filtros, exclusiones (propias,
  descartadas sin cambio posterior, VPP) y zona inversa (la candidata busca
  donde está mi vivienda); (2) el dominio aplica la compatibilidad económica
  sobre la página de candidatas. Alternativa descartada: todo en SQL — duplica
  la regla RN-03 fuera del dominio y la deja sin pruebas de propiedades.
- **Paginación** por cursor opaco (`published_at` + `id`, codificado en
  base64url) con sobremuestreo para compensar las candidatas que descarta la
  fase económica.
- **Índices**: GIST sobre `homes.approx_location` y `exact_location`, parcial
  por `status = 'published'`, y sobre `search_preferences.areas`.
- **App**: pila de tarjetas con `react-native-reanimated` (base del gesto que
  añade el change siguiente), carrusel con `expo-image` (caché y transiciones),
  degradado `photoScrim*` y píldora con los tokens `compensation*`.

## Risks / Trade-offs

- [Rendimiento con 50.000 viviendas] → prueba de integración con datos
  sintéticos que mide la consulta; índices revisados con `EXPLAIN`.
- [Sobremuestreo insuficiente si muchas candidatas fallan la economía] → el
  servidor repite la fase 1 hasta llenar la página o agotar candidatas.

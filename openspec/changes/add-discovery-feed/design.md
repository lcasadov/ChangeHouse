# Design

## Context

Existen viviendas con ubicación PostGIS y estados (`homes`), fotos, moderación y
preferencias efectivas por vivienda (`resolveEffectivePreferences`, de
`add-search-preferences`). Objetivo de rendimiento: p95 < 300 ms en lecturas
(RNF-20). El contrato declara `discoverHomes`, pero sus elementos son
`HomePublic`, que no lleva compensación. Motivación en `proposal.md`.

## Decisions

- **Contrato**: los elementos de `discoverHomes` pasan a `DiscoveryCard` =
  `HomePublic` + `compensation` (`{ kind: 'receive' | 'pay' | 'fair',
  amountCents }`, `amountCents` ≥ 0, o `null` en modo `seeker`). Se documentan
  el 422 cuando no hay preferencias y el 400/404 de `homeId` (ajeno, no
  publicado, u omitido por un `owner` con varias publicadas).
- **Valor de referencia** de una vivienda = `min + pct · (max − min)` con el
  `value_reference_pct` de las preferencias efectivas de su dueño (por defecto
  50), en céntimos enteros. Compensación del usuario = valor de la candidata −
  valor de la suya. Función pura del dominio (`domain/matching/compensation.ts`),
  reutilizada por el matching. «Cambio justo» cuando |diferencia| ≤ 1 % del
  mayor de los dos valores (decisión de presentación; el cálculo exacto se
  conserva). Pruebas de propiedades con `fast-check`.
- **Consulta en dos fases**: (1) SQL con PostGIS filtra candidatas publicadas
  por zona (`ST_DWithin` / municipio normalizado), filtros, exclusiones
  (propias, descartadas sin cambio posterior, VPP) y zona y filtros inversos (la
  candidata busca donde está y como es mi vivienda, con sus preferencias
  efectivas; sin preferencias no es compatible); (2) el dominio aplica la
  compatibilidad económica sobre la página de candidatas. Alternativa
  descartada: todo en SQL — duplica la regla RN-03 fuera del dominio y la deja
  sin pruebas de propiedades.
- **Paginación** por cursor opaco (`published_at` + `id`, codificado en
  base64url) con sobremuestreo para compensar las candidatas que descarta la
  fase económica. `published_at` se fija al aprobar en moderación (columna
  nueva, con relleno para las ya publicadas). Página por defecto 20, máximo 50.
- **Índices**: GIST sobre `homes.approx_location` y `exact_location`, parcial
  por `status = 'published'`, y sobre la zona de `search_preferences`.
- **Municipio de la vivienda**: `homes.municipality` y
  `municipality_normalized` (nuevas) se rellenan con la localidad que devuelve
  el resolvedor de lugares; `area_name` es el barrio y no sirve para cruzar con
  los municipios de las preferencias. Las viviendas previas sin municipio solo
  casan por radio. El radio se mide desde el punto público de la candidata.
- **Descartes**: este change crea la tabla `dismissals` (`home_id`,
  `dismissed_home_id`, `created_at`, PK compuesta, `CASCADE`) solo para la
  exclusión; descartar y deshacer llegan con `add-like-dismiss-undo`. Las
  pruebas siembran descartes en la base.
- **Cambio relevante**: `relevant_changed_at` se actualiza en el mismo caso de
  uso al cambiar el rango de valor y al confirmar o borrar una foto.
- **Modo `seeker`** (sin vivienda publicada): preferencias por defecto, sin
  compatibilidad inversa ni compensación. Un `owner` con una sola vivienda
  publicada puede omitir `homeId`.
- **App**:
  - Pila de tarjetas con `react-native-reanimated` (base del gesto que añade el
    change siguiente), carrusel con `expo-image` (caché y transiciones) por
    toques laterales con indicador, degradado `photoScrim*`, zona, m²,
    dormitorios y baños, y píldora con los tokens `compensation*` y
    «Estimación orientativa».
  - Selector de la vivienda desde la que se busca cuando hay varias publicadas.
  - TanStack Query (`useInfiniteQuery`) con precarga de la página siguiente al
    quedar 3 tarjetas. Sin gestos de me gusta todavía: solo «Siguiente», que
    pasa de tarjeta sin descartar.
  - Detalle de vivienda ajena con galería, características y mapa
    (`react-native-maps` en móvil; en web y en pruebas, la zona sin mapa
    interactivo) con el punto público y el nombre de la zona, nunca la
    dirección.
  - Estado vacío con «Ampliar zona» y «Ajustar compensación», que abren la hoja
    de filtros de `add-search-preferences`; aviso fijo para `seeker`: «Publica
    tu vivienda para poder hacer match».

## Risks / Trade-offs

- [Rendimiento con 50.000 viviendas] → prueba de integración con datos
  sintéticos que mide la consulta; índices revisados con `EXPLAIN`.
- [Sobremuestreo insuficiente si muchas candidatas fallan la economía] → el
  servidor repite la fase 1 hasta llenar la página o agotar candidatas.
- [Municipio por texto] → normalizado igual que en las preferencias; migrará a
  códigos INE.

# Design

## Context

`add-discovery-feed` sirve las tarjetas y ya crea la tabla `dismissals`
(`home_id`, `dismissed_home_id`) solo para excluir. El contrato declara
`likeHome` (`x-roles: [owner]`), `dismissHome` y `undoLastAction` (`owner`,
`seeker`). Los matches llegan con `add-direct-match`. Motivación en
`proposal.md`.

## Decisions

- **Tablas**: `likes` (`from_home_id`, `to_home_id`, `created_at`, PK compuesta,
  `CHECK` sin auto-like, `CASCADE`, índices por destino y por `(owner, día)`)
  y una tabla nueva `account_dismissals` (`user_id`, `dismissed_home_id`,
  `created_at`) para los descartes de un `seeker`, que no tiene vivienda desde
  la que descartar. El descubrimiento en modo `seeker` pasa a excluirlos con la
  misma regla de cambio relevante. Alternativa descartada: `dismissals.home_id`
  nulo con `user_id`, que rompe la PK compuesta.
- **Límite diario**: contador por usuario y día natural de `Europe/Madrid`
  calculado con `count(*)` sobre `likes` de sus viviendas (índice
  `likes(created_at)` + unión con `homes.owner_id`), dentro de la transacción
  con `pg_advisory_xact_lock(hash(user_id))` para que dos peticiones simultáneas
  no superen el límite. `LIKES_PER_DAY` (por defecto 10) en la configuración;
  reloj inyectado. 429 con `Retry-After` en segundos hasta la medianoche de
  Madrid (cambios de horario incluidos, con `Intl`/`Temporal` sin
  dependencias nuevas si es posible).
- **Errores de `likeHome`**: política → 403 a `seeker`, `agency`, `admin`;
  `fromHomeId` ajeno o inexistente → 404; propio no publicado → 409
  `HOME_NOT_PUBLISHED`; destino propio, no publicado o inexistente → 404;
  repetido → 409 `LIKE_EXISTS`. `LikeResult.match` es siempre `null` en este
  change.
- **Descartar**: `dismissHome` con `fromHomeId` (propia y publicada, si no 404)
  o sin él para un `seeker` (un `owner` sin `fromHomeId` → 400). Repetir un
  descarte actualiza `created_at` (idempotente, 204).
- **Deshacer**: la última acción es la más reciente entre `likes` y descartes
  de esa vivienda (o de la cuenta para `seeker`) por `created_at`; sin acción →
  404. Un like que forma parte de un match → 409 `LIKE_IN_MATCH`, consultado con
  el puerto `MatchLookup` (`isLikeInMatch(from, to)`), cuya implementación en
  este change devuelve siempre `false`; `add-direct-match` la sustituye. Deshacer
  un like devuelve el cupo del día (se cuenta sobre los likes existentes). El
  límite de 5 segundos es de la interfaz, no de la API.
- **App**:
  - Gesto con `react-native-gesture-handler` y Reanimated: umbral del 30 % del
    ancho o velocidad; la tarjeta rota ligeramente y muestra los sellos «Me
    gusta» y «Descartar» con opacidad proporcional.
  - Botones grandes y siempre visibles bajo la tarjeta (descartar, deshacer,
    me gusta), con etiquetas y anuncio del resultado
    (`AccessibilityInfo.announceForAccessibility`).
  - Háptica con `expo-haptics` (ligera al cruzar el umbral, éxito al
    registrar); sin háptica en web.
  - «Reducir movimiento» (`AccessibilityInfo.isReduceMotionEnabled` /
    `useReducedMotion`): fundido sin vuelo ni rotación.
  - Optimista: la tarjeta sale al instante y la mutación se envía; ante error,
    la tarjeta vuelve con un mensaje accionable; 429 muestra «Has usado tus 10
    me gusta de hoy. Podrás seguir a las 00:00» y deja descartar.
  - Barra «Deshacer» 5 s tras cada decisión; un `seeker` que intenta «Me
    gusta» ve una hoja que le invita a publicar su vivienda (enlace a «Mis
    casas»), sin llamar a la API.

## Risks / Trade-offs

- [Contar likes por consulta en cada petición] → índice y bloqueo por usuario;
  con 10 al día el coste es mínimo.
- [`MatchLookup` provisional] → el escenario «No se deshace un match» se
  prueba con un doble del puerto; la prueba de integración real llega con
  `add-direct-match`.

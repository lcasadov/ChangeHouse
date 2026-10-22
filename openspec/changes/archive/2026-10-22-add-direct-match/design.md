# Design

## Context

Los «Me gusta» son aristas `likes(from_home_id → to_home_id)`
(`add-like-dismiss-undo`); la compensación y su aceptabilidad viven en
`domain/matching/compensation.ts` (`add-discovery-feed`). Algoritmo de
referencia en README §11. Motivación en `proposal.md`.

## Decisions

- **Reparto de responsabilidades**: el adaptador de persistencia busca ciclos
  candidatos (consulta SQL de README §11) detrás del puerto
  `CycleCandidates`; el dominio valida publicación, compatibilidad económica y
  calcula las compensaciones y la **clave canónica** (identificadores de
  vivienda ordenados y unidos). Así la regla RN-03 tiene pruebas de propiedades
  sin base de datos.
- **Transacción y concurrencia**: el caso de uso `likeHome` inserta la arista y
  busca y crea el match en una sola transacción `READ COMMITTED`; la unicidad
  la garantiza `UNIQUE (cycle_key)` con `INSERT … ON CONFLICT DO NOTHING
  RETURNING`; si no devuelve fila, se lee el match existente. Alternativa
  descartada: bloqueo con `SERIALIZABLE` — reintentos y más latencia sin
  ventaja sobre la restricción única.
- **Likes cruzados simultáneos**: en `READ COMMITTED`, si A→B y B→A llegan a
  la vez ninguna transacción ve la arista no confirmada de la otra y no se
  crearía match. Antes de insertar la arista se toma
  `pg_advisory_xact_lock` sobre la clave canónica del par `{from, to}`, de modo
  que la segunda transacción espera, ve la arista confirmada de la primera y
  crea el match (o lo encuentra). La prueba con barrera lo verifica.
- **`MatchLookup` real**: sustituye al provisional de `add-like-dismiss-undo`;
  un like forma parte de un match si existe un match no cerrado cuyos
  participantes incluyen ambas viviendas en ese sentido.
- **Contrato**: `LikeResult.match` deja de ser siempre `null`; `Match` y
  `MatchParticipant` del contrato se rellenan con `type: 2`, estado `open`,
  `chatId` ausente hasta `add-match-chat`, y en cada participante la
  vivienda que da, la que recibe y la compensación.
- **Diseño extensible a ciclos de 3**: el puerto devuelve ciclos como listas
  ordenadas de viviendas; `add-chain-match` añade la consulta de longitud 3 sin
  tocar el dominio.
- **App**: la respuesta de `likeHome` con match abre la celebración (modal de
  pantalla completa, degradado `matchGradient*`, animación de intercambio con
  Reanimated; fundido con «reducir movimiento»). «Matches» lista con
  TanStack Query e invalidación tras cada like con match.

## Risks / Trade-offs

- [Carrera con un cambio de estado de la otra vivienda] → la comprobación de
  publicación se hace dentro de la transacción leyendo el estado actual.
- [Pruebas de concurrencia frágiles] → la prueba lanza los dos casos de uso en
  paralelo contra PostgreSQL real con una barrera, y se repite varias veces.

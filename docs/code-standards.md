# ChangeHouse — Estándares de código

> `$CODE_STANDARDS_DOC`. **Aún no hay código**: no se pueden extraer
> convenciones existentes. Las reglas salen de las decisiones del README
> (TypeScript `strict`, ESLint + Prettier, hexagonal en la API, feature-based en
> la app), de la nomenclatura del modelo de datos y del contrato de API, y del
> skill `code-quality` (`.claude/skills/code-quality/typescript-react.md`), que
> se aplica **mientras se escribe** y no se repite aquí.
>
> Cuando exista código, repite el prompt 09 para contrastar.

---

## 1 · Reglas verificadas automáticamente

Las impone una herramienta; no se discuten en revisión.

| Regla | Herramienta |
|---|---|
| Formato (indentación, comillas, punto y coma, ancho de línea) | Prettier (configuración única en la raíz) |
| TypeScript `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` (⚠️ SUPUESTO: las dos últimas) | `tsc --noEmit` (`pnpm typecheck`) |
| Sin `any` explícito, sin promesas flotantes, sin variables sin usar | `@typescript-eslint` (`no-explicit-any`, `no-floating-promises`, `no-unused-vars`) |
| Reglas de los hooks de React | `eslint-plugin-react-hooks` |
| Fronteras entre capas y features (I-1…I-7 de `docs/architecture.md`) | `eslint-plugin-boundaries` o `dependency-cruiser` (⚠️ elegir en el scaffold) |
| Sin `.only` ni `.skip` en pruebas | `eslint-plugin-vitest` |
| Sin `console.*` fuera de los adaptadores de log | `no-console` |
| Importaciones ordenadas | Regla de ordenación de importaciones de ESLint |
| Complejidad cognitiva < 15 por función | `eslint-plugin-sonarjs` (`cognitive-complexity`) |

## 2 · Nomenclatura

| Elemento | Convención | Correcto | Incorrecto |
|---|---|---|---|
| Ficheros | `kebab-case.ts`; componentes React `PascalCase.tsx` | `detect-cycles.ts`, `HomeCard.tsx` | `DetectCycles.ts`, `home_card.tsx` |
| Pruebas | junto al código, `*.test.ts(x)`; integración `*.int.test.ts` | `detect-cycles.test.ts` | `tests/test1.ts` |
| Tipos e interfaces | `PascalCase`, sin prefijo `I` | `HomeRepository` | `IHomeRepository` |
| Funciones y variables | `camelCase`, verbo para funciones | `calculateCompensation` | `compensation_calc` |
| Constantes de módulo | `UPPER_SNAKE_CASE` | `MAX_CYCLE_LENGTH` | `maxCycleLength` |
| Casos de uso | verbo + objeto, un fichero por caso de uso | `like-home.ts` → `likeHome()` | `home-service.ts` con veinte métodos |
| Puertos | sustantivo de rol | `Notifier`, `PaymentGateway` | `FcmService` en `application/` |
| Adaptadores | tecnología + puerto | `DrizzleHomeRepository`, `FcmNotifier` | `HomeRepositoryImpl` |
| Tablas y columnas | inglés, `snake_case`, tablas en plural | `match_participants.receives_home_id` | `MatchParticipant.receivesHome` |
| Campos JSON de la API | `camelCase`; importes con sufijo `Cents` | `valueMinCents` | `value_min`, `valueMin` (ambiguo) |
| Rutas HTTP | plural, `kebab-case` | `/me/search-preferences` | `/searchPreference` |
| Hooks propios | prefijo `use` | `useDiscoverHomes` | `discoverHomesHook` |

**Idioma**: identificadores y valores de enumerados en **inglés** —también los
roles: `visitor`, `seeker`, `owner`, `agency`, `admin`—; comentarios,
mensajes de commit y documentación en **español**; textos visibles siempre
vía i18n (`i18next`), que traduce también los roles y estados.

## 3 · Organización

- **API** (`services/api/src`): `domain/`, `application/`, `infrastructure/`,
  `interfaces/http/`, cada una subdividida por módulo de negocio (`homes/`,
  `matching/`, `matches/`, `accounts/`, `moderation/`). Un caso de uso por
  fichero.
- **App** (`apps/mobile`): `app/` solo rutas de Expo Router que componen
  pantallas; `src/features/<feature>/{components,hooks,api}/`; lo común en
  `packages/ui` o `packages/shared`.
- **Contratos compartidos**: los esquemas Zod de entrada y salida de la API
  viven en `packages/shared` y se generan o contrastan contra
  `docs/api/openapi.yaml`. No se duplican a mano en la app.

## 4 · Reglas de criterio

Exigen juicio; se discuten en la revisión.

**Tamaño.** Una función hace una cosa; si necesita un comentario para separar
pasos, son varias funciones. Orientativo: > 40 líneas o > 300 por fichero
merece una segunda mirada.

**Errores.**
- El dominio devuelve errores de negocio **tipados** (clases propias que
  extienden `DomainError` con un `code` estable, p. ej. `HOME_NOT_EDITABLE`).
- `interfaces/http` traduce cada `code` a su estado HTTP y a `Problem`; es el
  **único** sitio que conoce los códigos HTTP.
- Solo se captura una excepción donde se puede hacer algo con ella. Nunca un
  `catch` vacío.

```ts
// Correcto
if (!home.isEditable()) throw new HomeNotEditableError(home.id);

// Incorrecto: el dominio no conoce HTTP
if (!home.isEditable()) throw reply.code(409).send({ error: 'no editable' });
```

**Nulos y ausencia.** `undefined` para «no informado» en propiedades
opcionales; `null` solo donde el contrato de la API lo declara
(`type: [string, 'null']`). Los repositorios devuelven `Home | null` al buscar
por id, nunca lanzan por «no encontrado».

**Inmutabilidad.** Entidades de dominio con estado privado y métodos que
expresan transiciones (`home.submit()`, `match.withdraw(participant)`); sin
*setters* públicos. Objetos de valor (`Money`, `CycleKey`) inmutables. Las
funciones no mutan sus argumentos.

**Dinero.** Siempre enteros en céntimos (`Money`), nunca `number` con
decimales para importes.

**Fechas.** `timestamptz` en la base de datos, ISO 8601 en la API, y el reloj
siempre inyectado (`Clock`), nunca `new Date()` en el dominio.

**Concurrencia.** La creación de matches es transaccional y se apoya en la
restricción única de `cycle_key`; el conflicto de unicidad se traduce a «ya
existe», no a error 500. Sin estado mutable compartido en memoria del proceso
(Cloud Run escala horizontalmente).

**Registro de eventos.**

| Nivel | Cuándo |
|---|---|
| `error` | Fallo no esperado que requiere intervención |
| `warn` | Denegaciones 401/403, reintentos, degradación |
| `info` | Hitos de negocio: match creado, vivienda moderada |
| `debug` | Solo en DES |

Logs JSON con `correlationId`, `userId` (id interno) y `operationId`.
**Nunca** se registran: tokens, emails, teléfonos, direcciones exactas,
importes de hipoteca ni cuerpos completos de petición.

**Comentarios.** Explican el **porqué**, no el qué. JSDoc solo en puertos y
en la API pública de `packages/*`. En español.

## 5 · Prohibiciones

| Prohibido | Motivo |
|---|---|
| Importar infraestructura (Drizzle, Fastify, Firebase, Stripe) en `domain/` o `application/` | Rompe el hexagonal y obliga a usar dobles en el dominio |
| Lógica de negocio en rutas Fastify, adaptadores o componentes | Queda sin probar y duplicada |
| Decidir permisos en la app | La autorización solo vale en la API (regla 6) |
| `float`/`number` con decimales para dinero | Errores de redondeo en compensaciones |
| Literales de color, espaciado, radio o sombra en componentes | Rompe los temas (regla 9) |
| Texto visible escrito en el código | Rompe la internacionalización (regla 9) |
| Inventar endpoints o campos fuera de `docs/api/openapi.yaml` | Regla 4 |
| Secretos en el código o en ficheros versionados | Van en Secret Manager (RNF-04) |
| SQL construido concatenando cadenas | Inyección; usar Drizzle o parámetros |
| Suprimir reglas a nivel de fichero | Solo por línea y con motivo (skill `code-quality`) |
| Prefijos de tipo en commits (`feat:`, `fix:`…) | Alteran la versión con GitVersion (regla 3) |

## 6 · Excepciones

- **Código generado** (migraciones de drizzle-kit, tipos generados desde
  OpenAPI): no se edita a mano ni se le aplican estas reglas; se regenera.
- **Configuración** (`*.config.ts`): exenta de la regla de tamaño y de
  cobertura.
- **No hay código heredado** (`$LEGACY_MODULES` = N/A).

## Pendiente de decidir

1. Activar `noUncheckedIndexedAccess` y `exactOptionalPropertyTypes`.
2. Herramienta de fronteras: `eslint-plugin-boundaries` o `dependency-cruiser`.

Se deciden al crear el scaffold del monorepo (T-01).

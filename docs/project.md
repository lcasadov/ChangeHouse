# `docs/project.md` — Contrato de variables del proyecto

> Valores del perfil de ChangeHouse: GitHub, GitHub Actions, CodeRabbit y Claude
> Code (ver `.claude/harness/profile/project.partial.md`). Es la **fuente única
> de verdad** que consumen todos los agentes y reglas.
>
> Complétalo con `/harness:01-bootstrap-project`, que lo rellena a partir del
> código y del README sin tocar los valores ya fijados, y ciérralo con
> `/harness:02-audit-project`.

---

## 🚧 Qué NO va en este fichero

Este documento es el **contrato técnico**: variables, comandos, umbrales y
convenciones. Lo leen los agentes.

La visión de producto, el análisis de mercado, los casos de uso y el recorrido
del usuario van en **`docs/product.md`**, que lo leen las personas.

Mezclarlos rompe las dos cosas: un agente que busca un comando y encuentra un
diagrama de modelo de negocio no falla, **sigue adelante sin el dato**.

---

## 📋 Cómo se completa

### Reglas

1. **No inventes valores.** Si un dato no se deduce con certeza del `README.md`,
   del código fuente o de una respuesta del equipo, márcalo `⚠️ PENDIENTE`.
2. **`⚠️ PENDIENTE` es un estado válido y esperado.** Un agente que encuentra
   `⚠️ PENDIENTE` en una variable que necesita **para y pregunta**. Un valor
   inventado, en cambio, produce código incorrecto en silencio. La segunda
   situación es mucho peor que la primera.
3. **`N/A` para lo que no aplica.** Si el proyecto no tiene interfaz de usuario,
   toda la sección de cliente es `N/A`. Documenta el porqué en Aplicabilidad.
4. **Los comandos se escriben tal cual se ejecutan**, desde la raíz del
   repositorio, sin abreviaturas ni pseudocódigo. Un agente los va a ejecutar.
5. **Las rutas son relativas a la raíz del repositorio** y respetan mayúsculas y
   minúsculas exactas (los sistemas de CI suelen distinguirlas).
6. **Verifica antes de dar por bueno.** Un comando que no has ejecutado no es un
   valor válido: es una hipótesis.

### Leyenda de estado

| Marca | Significado |
|---|---|
| valor | Confirmado y verificado |
| `⚠️ PENDIENTE` | Desconocido — el agente debe parar y preguntar |
| `N/A` | No aplica a este proyecto (justificar en Aplicabilidad) |
| `⚠️ SUPUESTO: <valor>` | Deducido pero **sin verificar** — requiere confirmación |

---

## 0 · Identidad y aplicabilidad

| Campo | Valor |
|---|---|
| `$PROJECT_NAME` | `ChangeHouse` |
| Organización | `⚠️ SUPUESTO: cuenta personal lcasadov; ChangeHouse aún sin organización propia` |
| `$PROJECT_DESCRIPTION` | Plataforma móvil y web de permuta de viviendas entre particulares: monorepo TypeScript con app Expo (Android, iOS y web), landing Astro y API Fastify |
| Versión de esta plantilla | `harness v1.2.0` |
| Última actualización | `2026-10-18` |

### Comandos transversales

Los que ejecuta cualquiera que se siente ante el repositorio, sin importar la
capa. Deben funcionar **desde la raíz**; si cada capa tiene el suyo, indícalos
todos con su directorio de trabajo.

| Variable | Valor | Ejemplo |
|---|---|---|
| `$INSTALL_CMD` | `⚠️ SUPUESTO: pnpm install` | Instalación de dependencias |
| `$RUN_CMD` | `⚠️ SUPUESTO: pnpm dev` (Turborepo arranca app, landing y API) | Arranque en local |
| `$LINT_CMD` | `⚠️ SUPUESTO: pnpm lint` (ESLint + Prettier) | Análisis estático y formato, o `N/A` |

**Aplicabilidad de las secciones:**

| Sección | ¿Aplica? | Justificación |
|---|---|---|
| Servidor | sí | API Fastify en `services/api` (README §8–9) |
| Cliente | sí | App Expo (Android, iOS, web) en `apps/mobile` y landing Astro en `apps/landing` |
| Persistencia | sí | PostgreSQL 17 + PostGIS (Cloud SQL) y Firestore para el chat |
| Infraestructura y despliegue | sí | Google Cloud + Firebase, GitHub Actions, EAS |
| Módulos heredados | no | Proyecto nuevo: no hay código previo |

> Si una sección no aplica, **elimina también los artefactos correspondientes**
> de `.claude/agents/` y `.claude/rules/`. No dejes reglas huérfanas.

---

## 1 · Repositorio y gestión de trabajo

| Variable | Valor | Valores admitidos / ejemplo |
|---|---|---|
| `$REPO_ROOT` | `C:\proyectos\Habitinder` (copia local del desarrollador; el repositorio remoto es `ChangeHouse`) | Ruta absoluta a la raíz del repositorio |
| `$VCS_PROVIDER` | `github` | `azure-devops` · `github` · `gitlab` · `bitbucket` |
| `$REPO_ID` | `lcasadov/ChangeHouse` | Identificador del repositorio en el proveedor |
| `$BASE_BRANCH` | `develop` | Rama de integración: `develop` · `main` · `master` |
| `$PROD_BRANCH` | `master` | Rama de producción: `main` · `master`. Origen de los `hotfix` |
| `$LINKED_REPOS` | `ninguno` | Solo topología `multirepo`. Repositorios enlazados que comparten rama con este (ruta o nombre del submódulo), separados por coma. `ninguno` desactiva la rama espejo |
| `$TRACKER` | `github-issues` | `azure-devops` · `github-issues` · `jira` · `linear` · `ninguno` |
| `$TRACKER_ORG` | `lcasadov` (cuenta personal de GitHub) | Organización o cuenta en el gestor |
| `$TRACKER_PROJECT` | `2` — Project «ChangeHouse» (https://github.com/users/lcasadov/projects/2), enlazado al repositorio. Id GraphQL `PVT_kwHOAGwvnc4BnofG` | Proyecto o tablero |
| `$TRACKER_HIERARCHY` | `Epic > Feature > Story > Task` (etiquetas `tipo:*` + sub-issues) | Niveles de mayor a menor, p. ej. `Epic > Feature > User Story > Task`. Los nombres varían por proceso: **no los deduzcas** |
| `$TRACKER_LIFECYCLE` | Ver tabla «Ciclo de vida de los elementos» | Estados y campos de fecha **por tipo** de elemento |
| `$TRACKER_FIELDS` | Ver tabla «Campos de cada elemento» | Campos que se escriben en cada tipo, con su origen |
| `$TRACKER_TEAM` | `N/A` — GitHub Projects no tiene equipos ni áreas | Equipo de `$TRACKER_PROJECT` cuyos sprints y área por defecto se usan |
| `$TRACKER_SPRINT` | `2 semanas · Sprint NN`: campo de iteración `Sprint` del Project, con iteraciones de 14 días | Duración y patrón de nombre del sprint, p. ej. `2 semanas · Sprint NN (AAAA-MM-DD - AAAA-MM-DD)`, o `ninguno` si el proyecto no trabaja por sprints |
| `$TRACKER_DISCIPLINE_TAGS` | `back` · `front` · `bd` · `devops` · `qa` · `docs` | Etiquetas de disciplina admitidas en las tareas, p. ej. `back` · `front` · `devops` |
| `$TICKET_PREFIX` | *(vacío — los identificadores son enteros: `#<número de issue>`)* | Prefijo de identificadores, o vacío si el gestor usa enteros |
| `$COMMIT_CONVENTION` | Descripción en imperativo + `#<ID>` de la tarea o defecto. **Sin prefijos de tipo** | Convención de mensajes, o `ninguna` |
| `$VERSIONING_TOOL` | `GitVersion` | Herramienta de versionado, o `ninguna` |
| `$VERSION_BUMP_KEYWORDS` | `breaking`, `BREAKING CHANGE`, `increment major`, `feat`, `increment minor` | Palabras que alteran la versión, o `ninguna` |
| `$REVIEWER` | `coderabbitai[bot]` (revisión automática obligatoria). Proyecto con un único desarrollador: GitHub no permite aprobar la propia PR, así que no se exige aprobación humana | Revisor obligatorio de las propuestas de integración |
| `$AGENTS_PATH` | `.claude/agents` | Ruta del catálogo de agentes |

**Convención de ramas y origen de cada tipo**

> ⛔ **El origen no es siempre el mismo.** Un `hotfix` creado desde
> `$BASE_BRANCH` publica en producción código que nunca se liberó.

| Tipo | Se crea desde | Se integra en | Uso |
|---|---|---|---|
| `feature/<id>-<slug>` | `$BASE_BRANCH` | `$BASE_BRANCH` | Nueva funcionalidad |
| `bugfix/<id>-<slug>` | `$BASE_BRANCH` | `$BASE_BRANCH` | Defecto no crítico |
| `hotfix/<id>-<slug>` | `$PROD_BRANCH` | `$PROD_BRANCH` **y** `$BASE_BRANCH` | Defecto crítico en producción |
| `release/<versión>` | `$BASE_BRANCH` | `$PROD_BRANCH` | Preparación de entrega |

Ajusta la tabla si el proyecto usa otra estrategia, pero **deja siempre
explícito el origen de cada tipo**.

**Rama espejo** (solo topología `multirepo`, con `$LINKED_REPOS` distinto de
`ninguno`). Detalle en el skill `rama-espejo`.

- **Nombre y origen:** la rama temporal existe con el mismo nombre en el
  superrepositorio y en cada repositorio enlazado. El origen se decide por el
  tipo **en cada repositorio**: `hotfix` nace de `$PROD_BRANCH`; `feature`,
  `bugfix` y `release`, de `$BASE_BRANCH`.
- **Punteros:** en la rama espejo del superrepositorio, el gitlink de cada
  submódulo apunta a la punta de su rama espejo. Al integrar, a la revisión
  integrada en `$BASE_BRANCH`.
- **`.gitmodules`:** `branch = .` en cada submódulo, para que
  `git submodule update --remote` siga la rama homónima.
- **Integración:** una propuesta por repositorio **con commits**, todas
  enlazadas al mismo elemento de trabajo. Un `hotfix` integra en `$PROD_BRANCH`
  y en `$BASE_BRANCH` de **cada** repositorio que haya cambiado.
- **Ramas vacías:** una rama espejo sin commits propios no genera propuesta y
  se borra al integrar.

**Ciclo de vida de los elementos (`$TRACKER_LIFECYCLE`)**

Una fila por cada tipo de `$TRACKER_HIERARCHY`, más el tipo de defecto. Si
`$TRACKER` vale `ninguno`, elimina la tabla.

| Tipo | Al crear | Al empezar | Al terminar | Campo de inicio | Campo de fin |
|---|---|---|---|---|---|
| Epic | `open` · Status `Todo` | Status `In Progress` | `closed` (completed) · Status `Done` | `Start date` | — |
| Feature | `open` · Status `Todo` | Status `In Progress` | `closed` (completed) · Status `Done` | `Start date` | — |
| Story | `open` · Status `Todo` | Status `In Progress` | `closed` (completed) · Status `Done` | `Start date` | `End date` |
| Task | `open` · Status `Todo` | Status `In Progress` | `closed` (completed) · Status `Done` | `Start date` | `End date` |
| Bug | `open` · Status `Todo` | Status `In Progress` | `closed` (completed) · Status `Done` | `Start date` | `End date` |

> **Los estados y los campos se consultan en el gestor, no se suponen.** Cada
> proceso tiene los suyos, y a menudo están personalizados: un tipo puede no
> tener `Resolved`, o no tener campo de fin. En GitHub, los campos y sus
> opciones se consultan con `gh project field-list`.
>
> - **Al terminar** es el estado que se aplica cuando el trabajo del elemento
>   acaba. No tiene por qué ser el mismo para todos los tipos.
> - Los campos se indican por su **nombre** exacto (en GitHub Projects, p. ej.
>   `Start date`). `—` si el tipo no tiene un
>   campo adecuado. **No uses un campo de planificación** (fecha objetivo) como
>   fecha real de fin: falsea la planificación.
> - Comprueba la **categoría** del estado final: en algunos procesos un estado
>   llamado «resuelto» cuenta como «en curso» en tableros y agregados.

**Campos de cada elemento (`$TRACKER_FIELDS`)**

Una fila por campo y tipo. «Valor» es uno de los orígenes de
`.claude/harness/openspec-extensions/tracker-sync.md`, sección «Campos de cada
elemento», o un literal entre comillas. «Se escribe» es `al crear` o
`al terminar`. Si `$TRACKER` vale `ninguno`, elimina la tabla.

| Tipo | Campo | Valor | Se escribe |
|---|---|---|---|
| Story | Cuerpo | `narrativa` y, debajo, `## Criterios de aceptación` con `escenarios` | al crear |
| Story | `Story Points` | `trazabilidad`. Fibonacci: 1, 2, 3, 5, 8; 13 o más, divide el requisito | al crear |
| Story | `Priority` | `trazabilidad`. `P1` crítica · `P2` alta · `P3` media · `P4` baja | al crear |
| Story | `Sprint` | `sprint` | al crear |
| Task | Cuerpo | `tarea` | al crear |
| Task | `Estimate (h)` | `est`. Horas: 1, 2, 3, 5, 8, 13, 21; más de 21, divide la tarea | al crear |
| Task | Etiquetas | `disc` (como `disc:<disciplina>`) | al crear |
| Task | `Priority` | `prioridad-story` | al crear |
| Task | `Sprint` | `sprint` | al crear |
| Task | `Real (h)` | `real` | al terminar |
| Bug | `Sprint` | `sprint` | al crear |

> «Cuerpo» es el texto del issue; el resto son campos de `$TRACKER_PROJECT` y
> deben existir con ese nombre: compruébalo con `gh project field-list`. Lo que no figure en la tabla
> no se escribe.

**Versionado y mensajes de commit**

| Campo | Valor |
|---|---|
| Estrategia de versionado | SemVer `Major.Minor.Patch` con GitVersion (`.claude/harness/profile/versioning.md`) |
| ¿El versionado lee los mensajes de commit? | sí |
| Palabras que provocan incremento mayor | `breaking`, `BREAKING CHANGE`, `increment major` |
| Palabras que provocan incremento menor | `feat`, `increment minor` |
| Palabras que provocan incremento de parche | ninguna declarada en el perfil (el parche es el incremento por defecto) |
| Fichero de configuración del versionado | `GitVersion.yml` en la raíz. ⚠️ Aún no existe: lo crea el agente `devops` con el primer workflow de build |

> Si la respuesta a la segunda fila es **sí**, rellena las tres siguientes con
> las palabras exactas y agrégalas a `$VERSION_BUMP_KEYWORDS`. Los agentes tienen
> prohibido usarlas sin instrucción expresa: un mensaje descuidado altera la
> versión de un artefacto publicado, y las versiones liberadas son inmutables.

**Herramienta de acceso a `$TRACKER`:** CLI `gh` (subcomandos `gh issue`,
`gh project`, `gh pr` y, cuando no hay subcomando, `gh api`). Requiere
`gh auth status` correcto y el permiso `project` para escribir en el Project.

> Los agentes no usan `curl` ni tokens escritos a mano. El detalle de cada
> operación está en `.claude/harness/openspec-extensions/tracker-sync.md`.

---

## 2 · Arquitectura

| Variable | Valor | Valores admitidos |
|---|---|---|
| `$ARCH_STYLE` | `hexagonal` en la API (`services/api`) · `feature-based` en la app (`apps/mobile`). Heterogéneo por diseño (README §9) | `hexagonal` · `layered` · `feature-based` |

**Estructura de directorios y reglas de dependencia:**

> ⚠️ SUPUESTO: estructura declarada en el README §9. Aún no hay código; se
> confirma al crear el scaffold del monorepo.

```
ChangeHouse/
├── apps/
│   ├── mobile/                  # Expo + Expo Router: Android, iOS y web (feature-based)
│   │   ├── app/                 #   rutas de Expo Router: solo composición de pantallas
│   │   └── src/features/<f>/    #   auth, homes, discover, matches, chat… (UI, hooks, api)
│   └── landing/                 # Astro: web pública, blog y lista de espera
├── services/
│   └── api/                     # Fastify (hexagonal)
│       └── src/
│           ├── domain/          #   entidades, reglas, matching, simulador fiscal; sin dependencias externas
│           ├── application/     #   casos de uso y puertos (interfaces); depende solo de domain
│           ├── infrastructure/  #   adaptadores de salida: Drizzle, Firebase, Stripe, email
│           └── interfaces/http/ #   adaptadores de entrada: rutas Fastify y validación Zod
├── packages/
│   ├── shared/                  # esquemas Zod, tipos y constantes comunes (app ↔ API)
│   └── ui/                      # tokens de diseño y componentes compartidos
├── db/migrations/               # migraciones SQL generadas con drizzle-kit
├── infra/                       # servicios GCP y scripts de despliegue
├── docs/
└── openspec/
```

Reglas de dependencia:

- `domain` no importa nada fuera de `domain`: ni Fastify, ni Drizzle, ni Firebase, ni Stripe.
- `application` importa `domain` y define los puertos; nunca importa `infrastructure` ni `interfaces`.
- `infrastructure` implementa puertos de `application`; `interfaces/http` invoca casos de uso de `application`.
- `apps/*` y `services/*` solo comparten código a través de `packages/*`; nunca se importan entre sí.
- En `apps/mobile`, una feature no importa el interior de otra: lo común sube a `packages/ui` o `packages/shared`.

**Invariantes** (obligatorios en cualquier estilo):

- Nunca saltarse una capa
- Nunca importar infraestructura desde el dominio
- Nunca lógica de negocio en un adaptador

---

## 3 · Servidor

| Variable | Valor | Ejemplo |
|---|---|---|
| `$LANGUAGE` | TypeScript 5 (modo `strict`) sobre Node.js 24 LTS | Lenguaje y versión |
| `$FRAMEWORK` | Fastify (API) | Framework principal y versión |
| `$BUILD_TOOL` | pnpm workspaces + Turborepo | Herramienta de construcción |
| `$SRC_ROOT` | `⚠️ SUPUESTO: services/api/src` | Raíz del código de servidor |
| `$BUILD_VERIFY_CMD` | `⚠️ SUPUESTO: pnpm build` | Comando que compila y verifica |
| `$TEST_CMD` | `⚠️ SUPUESTO: pnpm test` (Vitest, todo el monorepo vía Turborepo) | Comando de la suite de pruebas |

### Persistencia

| Variable | Valor | Ejemplo |
|---|---|---|
| `$DB` | PostgreSQL 17 + PostGIS (Cloud SQL). Chat en Cloud Firestore | Motor de datos y versión |
| `$ORM` | Drizzle ORM | Capa de acceso a datos, o `ninguno` |
| `$MIGRATION_TOOL` | drizzle-kit; migraciones en `db/migrations`, aplicadas con `⚠️ SUPUESTO: pnpm db:migrate` | Herramienta de migraciones de esquema |

### Módulos heredados

| Variable | Valor |
|---|---|
| `$LEGACY_MODULES` | `N/A` — proyecto nuevo, sin código heredado |

> Lista los módulos que **no** deben tocarse sin un análisis previo en
> `docs/modules-analysis/<modulo>.md`. Si no hay código heredado, `N/A`.

---

## 4 · Cliente

| Variable | Valor | Ejemplo |
|---|---|---|
| `$UI_FRAMEWORK` | Expo (React Native) + Expo Router, `⚠️ SUPUESTO: última SDK estable al crear el scaffold`. Landing: Astro | Framework de interfaz y versión |
| `$UI_LIBRARY` | `⚠️ SUPUESTO: ninguna de terceros; componentes propios en packages/ui` | Librería de componentes, o `ninguna` |
| `$BUNDLER` | `⚠️ SUPUESTO: Metro (Expo) y Vite (Astro)` | Empaquetador o herramienta de construcción |
| `$FRONTEND_ROOT` | `⚠️ SUPUESTO: apps/mobile` (app) y `⚠️ SUPUESTO: apps/landing` (landing) | Raíz del código de cliente |
| `$STATE_MANAGEMENT` | TanStack Query (estado de servidor) + Zustand (estado local) | Gestión de estado global |
| `$HTTP_CLIENT` | `fetch` nativo envuelto en un cliente tipado `openapi-fetch`, con tipos generados desde `docs/api/openapi.yaml` (`openapi-typescript`); TanStack Query encima | Cliente de red configurado |
| `$TYPECHECK_CMD` | `⚠️ SUPUESTO: pnpm typecheck` (`tsc --noEmit` en cada paquete) | Comando de comprobación de tipos, o `N/A` |

### Presentación

| Variable | Valor | Ejemplo |
|---|---|---|
| `$THEMES` | claro (predeterminado) · oscuro; sigue la preferencia del sistema | Lista de temas soportados, con el predeterminado marcado |
| `$STYLE_GUIDE_DOC` | `docs/style-guide.md` (tokens implementados en `packages/ui`) | Ruta al documento de tokens y patrones |
| `$I18N` | `i18next` + `react-i18next` + `expo-localization`. Idiomas: `es-ES` en el MVP, preparado para inglés (RNF-42). Recursos en `apps/mobile/src/i18n/locales/<idioma>.json` (landing: i18n de Astro) | Sistema, idiomas soportados y ruta de recursos |
| `$A11Y_LEVEL` | WCAG 2.2 AA | Nivel de accesibilidad exigido |
| `$BROWSER_MATRIX` | Web: dos últimas versiones de Chrome, Safari, Firefox y Edge. Móvil: Android 10+, iOS 16+ | Navegadores y versiones mínimas soportadas |

> **`$STYLE_GUIDE_DOC` es obligatorio si hay interfaz.** Los agentes tienen
> prohibido usar valores literales de color, sombra, radio o espaciado: solo
> tokens. Si el documento no existe, no pueden trabajar.

---

## 5 · Calidad y pruebas

### Principio: *Clean as You Code*

El rigor se aplica al **código nuevo o modificado**, no al heredado. No se exige
sanear la deuda previa de golpe, pero **no se admite deuda nueva**.

| Variable | Valor | Ejemplo |
|---|---|---|
| `$COVERAGE_THRESHOLD` | `80%` | Umbral mínimo sobre código nuevo, p. ej. `80%` |
| `$COVERAGE_SCOPE` | Código nuevo | Qué se mide y qué se excluye |
| `$NEW_CODE_DEFINITION` | Líneas añadidas o modificadas por la Pull Request respecto a su rama de destino | Qué cuenta como código nuevo |
| `$COVERAGE_CMD` | `⚠️ SUPUESTO: pnpm test:coverage` (Vitest con umbral de cobertura configurado) | Comando que genera el informe |
| `$QG_PROVIDER` | `CodeRabbit` (revisión automática de Pull Requests en GitHub) | Herramienta de análisis estático y puerta de calidad |
| `$QUALITY_GATE` | Checks de GitHub Actions (lint, tipos, pruebas, cobertura, `openspec-sync` y escaneo de dependencias sin vulnerabilidades críticas) en verde **y** revisión de CodeRabbit sobre el HEAD de la PR en estado `APPROVED` o `COMMENTED` (nunca `CHANGES_REQUESTED`) y sin conversaciones abiertas, exigidos por la protección de rama de `$BASE_BRANCH` y `$PROD_BRANCH` (aplicada también a administradores) | Nombre de la puerta aplicada y criterio de bloqueo |
| `$QG_LEVEL` | `N/A` — ver `.claude/harness/profile/quality-gates.md` | Nivel o perfil asignado al proyecto, si aplica |
| `$CODE_STANDARDS_DOC` | `docs/code-standards.md` | Ruta a los estándares de codificación |
| `$TEST_FRAMEWORKS` | Unitarias e integración: Vitest · BD real: Testcontainers (PostgreSQL) · Componentes: React Native Testing Library · E2E web: Playwright · E2E móvil: Maestro · Propiedades: fast-check | Marcos de prueba por nivel |
| `$TEST_UNIT_CMD` | `⚠️ SUPUESTO: pnpm test` | Comando de pruebas unitarias |
| `$TEST_INTEGRATION_CMD` | `⚠️ SUPUESTO: pnpm test:integration` (decidido; se verifica con el scaffold) | Comando de pruebas de integración |
| `$TEST_E2E_CMD` | `⚠️ SUPUESTO: pnpm test:e2e` (decidido; Playwright en web y Maestro en móvil) | Comando de pruebas de extremo a extremo |
| `$PROPERTY_TESTING_LIB` | fast-check (obligatoria en matching y simulador fiscal, RNF-33) | Librería de pruebas basadas en propiedades, o `ninguna` |
| `$TEST_MANAGEMENT` | `ninguna` — los casos de prueba son los `#### Scenario:` de OpenSpec | Gestión de casos de prueba, o `ninguna` |

### Umbrales de la puerta de calidad

La cobertura es **necesaria pero no suficiente**. Declara el criterio completo,
separando código nuevo de código existente.

| Métrica | Código nuevo | Código existente |
|---|---|---|
| Cobertura | `≥ 80 %` | `≥ 80 %` (no puede empeorar) |
| Errores de lint y de tipos | `0` | `0` |
| Pruebas en rojo u omitidas | `0` | `0` |
| Hallazgos de CodeRabbit sin atender | `0` | — |
| Dependencias con vulnerabilidad crítica | `0` | `0` |

> Elimina las filas que la herramienta de `$QG_PROVIDER` no soporte. No inventes
> métricas que no vayas a poder medir.
>
> **Ningún agente puede bajar un umbral, excluir ficheros de la medición ni
> marcar incidencias como "no corregir".** Si un cambio parece requerirlo, se
> escala a una persona.
>
> **Fuente autoritativa de esta sección: `docs/TESTING-STRATEGY.md`.**
> Si hay discrepancia, manda ese documento y esta tabla debe corregirse.

---

## 6 · Seguridad y cumplimiento

| Variable | Valor | Ejemplo |
|---|---|---|
| `$AUTH_MECHANISM` | Firebase Authentication (email/contraseña, Google, Apple); la API verifica el ID token de Firebase en cada petición, sin sesión de servidor | Mecanismo de autenticación y modelo de sesión |
| `$ACCESS_SEGREGATION_MODEL` | Por rol —`visitor` (sin token); `owner` y `seeker`, **derivados** de tener o no vivienda publicada; `agency` y `admin`, **asignados** y exclusivos— más propiedad o participación en el recurso (vivienda, match, operación asignada). Deny-by-default centralizado en la API | Modelo de segregación: por rol, organización, ámbito… |
| `$RBAC_MATRIX_DOC` | `docs/rbac-matrix.md` | Ruta a la matriz de roles y permisos |
| `$NORMATIVA` | RGPD, LOPDGDD, LSSI-CE, OWASP ASVS nivel 2 (API y web), OWASP MASVS (móvil), WCAG 2.2 AA, directrices de App Store y Google Play | Marcos normativos aplicables, o `ninguno` |
| `$DATOS_CATEGORIA_ESPECIAL` | `⚠️ SUPUESTO: ninguna categoría del art. 9 RGPD en el MVP; el KYC de fase 2 puede tratar biometría, que se tratará como categoría especial`. Datos personales sensibles no especiales: dirección exacta, teléfono, cargas hipotecarias, situación VPP, edad ≥ 65 | ¿Se tratan datos sensibles? Cuáles |
| `$LOG_RETENTION` | Auditoría (`audit_log`): 2 años · Lista de espera: hasta el lanzamiento + 12 meses, o hasta la baja · Chat: mientras exista el match + 12 meses · Logs de aplicación: retención por defecto de Cloud Logging | Retención de registros de auditoría |
| `$EXPOSES_WEB_UI` | sí (app web de Expo, landing Astro y panel de administración) | `sí` / `no` — activa las comprobaciones de seguridad web |
| `$DAST_TOOL` | Análisis DAST asistido por IA: el agente `security` de Claude Code prueba la aplicación en ejecución en `DES`. Sin herramienta comercial | Herramienta de análisis dinámico, o `ninguna` |

> `$NORMATIVA` y `$DATOS_CATEGORIA_ESPECIAL` determinan el rigor de la auditoría
> de seguridad. Ante la duda, **declara el supuesto más restrictivo** y márcalo
> como supuesto: sobreproteger es recuperable, infraproteger no.

---

## 7 · Infraestructura y despliegue

| Variable | Valor | Ejemplo |
|---|---|---|
| `$CI_PROVIDER` | `GitHub Actions` | Proveedor de integración continua |
| `$PIPELINE_DIR` | `.github/workflows` | Ruta de las definiciones de pipeline |
| `$ENVIRONMENTS` | `DES → PROD` (GitHub Environments) | Entornos y su orden de promoción |
| `$DEPLOY_TARGET` | Cloud Run (API) en `europe-southwest1`; Firebase Hosting (landing y app web); EAS Submit a Google Play y App Store | Destino de despliegue |
| `$CONTAINER_RUNTIME` | Docker (imagen de la API para Cloud Run) | Runtime de contenedores, o `ninguno` |
| `$ARTIFACT_REGISTRY` | Artefacto generado por el workflow de build de GitHub Actions: imagen en Artifact Registry (servicios) o artefacto del workflow (web y móvil). Es el que se despliega en todos los entornos | Registro de artefactos |
| `$SECRETS_MANAGER` | Google Secret Manager en ejecución; secretos de GitHub Actions por environment solo para la CI, con Workload Identity Federation | Gestor de secretos |
| `$IAC_TOOL` | scripts `gcloud` en `infra/` durante el MVP; Terraform en fase 2 | Infraestructura como código, o `ninguna` |
| `$APPROVAL_POLICY` | Aprobación manual obligatoria para producción: *required reviewers* en el GitHub Environment `PROD` | Qué entornos exigen aprobación manual |
| `$OBSERVABILITY` | Logs JSON estructurados en Cloud Logging sin datos personales; errores en Sentry (app y API) con alertas por correo; Firebase Analytics con consentimiento; alerta de presupuesto en Google Cloud | Registro, métricas y trazas |

> **Ningún secreto se escribe en este fichero.** Solo la referencia al gestor y
> el nombre lógico de cada secreto.

---

## 8 · Especificación y contratos

| Variable | Valor | Ejemplo |
|---|---|---|
| `$OPENSPEC_PATH` | `openspec` | Raíz de los artefactos OpenSpec |
| `$API_CONTRACT` | `docs/api/openapi.yaml` (OpenAPI 3.1) | Ruta al contrato de la API |

> `$API_CONTRACT` es la fuente de verdad de endpoints, campos, enumerados y
> códigos de estado. **Los agentes no pueden inventar nada que no esté ahí.**

---

## 9 · Selección de modelo

Mapeo opcional de capacidad a modelo concreto. Si se deja vacío, cada agente
elige según la capacidad requerida descrita en `CLAUDE.md`.

| Capacidad | Modelo |
|---|---|
| Razonamiento alto | `opus` (orchestrator, security) |
| Equilibrada | `sonnet` (backend, frontend, tester, devops) |
| Rápida | `haiku` |

---

## ✅ Verificación antes de dar por completo

- [ ] No queda ningún `⚠️ PENDIENTE` en una sección marcada como aplicable
- [ ] Todo `⚠️ SUPUESTO` ha sido confirmado por el equipo o eliminado
- [ ] **Todos los comandos se han ejecutado** desde la raíz del repositorio y funcionan
- [ ] Todas las rutas existen y respetan mayúsculas y minúsculas exactas
- [ ] Los documentos referenciados existen: `docs/TESTING-STRATEGY.md`,
      `$RBAC_MATRIX_DOC`, `$STYLE_GUIDE_DOC`, `$CODE_STANDARDS_DOC`, `$API_CONTRACT`
- [ ] Los `paths` del frontmatter de `.claude/rules/` se han ajustado a la
      estructura real (ver `.claude/harness/RULES.md`)
- [ ] Los artefactos de secciones marcadas `N/A` se han eliminado del proyecto
- [ ] **Ningún secreto ni credencial figura en este fichero**

---

## Procedencia

Generado por `/harness:01-bootstrap-project` el 2026-10-18. No hay código
todavía: la fuente es el `README.md`. Los comandos y rutas quedan como
`⚠️ SUPUESTO` hasta que exista el scaffold y se ejecuten.

| Variable | Origen | Confianza |
|---|---|---|
| `$VCS_PROVIDER`, `$REPO_ID`, `$BASE_BRANCH`, `$PROD_BRANCH`, `$TRACKER*`, `$COMMIT_CONVENTION`, `$VERSIONING_TOOL`, `$VERSION_BUMP_KEYWORDS`, `$REVIEWER`, `$QG_PROVIDER`, `$QUALITY_GATE`, `$COVERAGE_*` (umbral, ámbito), `$CI_PROVIDER`, `$PIPELINE_DIR`, `$ENVIRONMENTS`, `$ARTIFACT_REGISTRY`, `$SECRETS_MANAGER`, `$APPROVAL_POLICY`, `$DAST_TOOL`, `$TEST_MANAGEMENT` | perfil | alta |
| `$PROJECT_NAME` | decisión del usuario (2026-10-18) | alta |
| Organización | deducido | baja |
| `$PROJECT_DESCRIPTION`, `$LANGUAGE`, `$FRAMEWORK`, `$BUILD_TOOL`, `$DB`, `$ORM`, `$STATE_MANAGEMENT`, `$TEST_FRAMEWORKS`, `$PROPERTY_TESTING_LIB` | README §8 | alta |
| `$ARCH_STYLE`, estructura de directorios | README §9 | media (sin código) |
| `$INSTALL_CMD`, `$RUN_CMD`, `$LINT_CMD`, `$BUILD_VERIFY_CMD`, `$TEST_CMD`, `$TYPECHECK_CMD`, `$COVERAGE_CMD`, `$TEST_UNIT_CMD`, migraciones | README §8 «Comandos previstos» | baja (no ejecutados) |
| `$SRC_ROOT`, `$FRONTEND_ROOT` | README §9 | media (rutas aún inexistentes) |
| `$UI_FRAMEWORK` (versión de SDK), `$UI_LIBRARY`, `$BUNDLER` | deducido | baja |
| `$THEMES`, `$A11Y_LEVEL`, `$BROWSER_MATRIX` | README §7 (RNF-40/41/43) | alta |
| `$STYLE_GUIDE_DOC`, `$CODE_STANDARDS_DOC`, `$RBAC_MATRIX_DOC`, `$API_CONTRACT` | deducido (rutas que generan los prompts 06, 07, 09 y 10) | media |
| `$AUTH_MECHANISM`, `$ACCESS_SEGREGATION_MODEL`, `$EXPOSES_WEB_UI` | README §4, §7, §8 | alta |
| `$NORMATIVA` | README §7, §13 | alta |
| `$DATOS_CATEGORIA_ESPECIAL` | deducido de README §5, §10, §13 | baja |
| `$DEPLOY_TARGET`, `$CONTAINER_RUNTIME`, `$IAC_TOOL`, `$OBSERVABILITY` | README §7, §12 | alta |
| `$LEGACY_MODULES` | README (proyecto nuevo) | alta |
| Versionado (tabla) | perfil `versioning.md` | alta |
| `$HTTP_CLIENT`, `$I18N`, `$LOG_RETENTION`, `$TEST_INTEGRATION_CMD`, `$TEST_E2E_CMD`, roles de `$ACCESS_SEGREGATION_MODEL` | decisión del usuario (2026-10-18, validación) | alta (comandos sin ejecutar) |

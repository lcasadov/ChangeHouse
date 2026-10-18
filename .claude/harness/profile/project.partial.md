# Perfil de Habitinder — valores del contrato

> Vuelca estas claves sobre `docs/project.md`. Lo que aparece como
> `⚠️ PENDIENTE` varía entre proyectos y debes completarlo.
>
> Tecnología del proyecto: **GitHub** (repositorio, Issues y Projects),
> **GitHub Actions**, **CodeRabbit** como revisión automática y **Google Cloud**
> como nube.

## 1 · Repositorio y gestión de trabajo

| Variable | Valor |
|---|---|
| `$VCS_PROVIDER` | `github` |
| `$TRACKER` | `github-issues` (GitHub Issues + GitHub Projects) |
| `$BASE_BRANCH` | `develop` |
| `$PROD_BRANCH` | `master` |
| `$TICKET_PREFIX` | *(vacío — los identificadores son enteros: `#<número de issue>`)* |
| `$COMMIT_CONVENTION` | Descripción en imperativo + `#<ID>` de la tarea o defecto. **Sin prefijos de tipo** |
| `$VERSIONING_TOOL` | `GitVersion` |
| `$VERSION_BUMP_KEYWORDS` | `breaking`, `BREAKING CHANGE`, `increment major`, `feat`, `increment minor` |
| `$TRACKER_SPRINT` | `2 semanas · Sprint NN`: campo de iteración `Sprint` del Project, con iteraciones de 14 días |
| `$TRACKER_DISCIPLINE_TAGS` | `back` · `front` · `bd` · `devops` · `qa` · `docs` |
| `$REPO_ID` · `$TRACKER_ORG` · `$TRACKER_PROJECT` · `$REVIEWER` | `⚠️ PENDIENTE` |
| `$TRACKER_TEAM` | `N/A` — GitHub Projects no tiene equipos ni áreas |

Ver `branching.md` y `versioning.md`.

## 5 · Calidad y pruebas

| Variable | Valor |
|---|---|
| `$QG_PROVIDER` | `CodeRabbit` (revisión automática de Pull Requests en GitHub) |
| `$QUALITY_GATE` | Checks de GitHub Actions (lint, tipos, pruebas y cobertura) en verde **y** revisión de CodeRabbit sin conversaciones abiertas, exigidos por la protección de rama de `$BASE_BRANCH` y `$PROD_BRANCH` (aplicada también a administradores) |
| `$QG_LEVEL` | `N/A` — CodeRabbit no tiene niveles; los umbrales están en `quality-gates.md` |
| `$COVERAGE_THRESHOLD` | `80%` |
| `$COVERAGE_SCOPE` | Código nuevo |
| `$NEW_CODE_DEFINITION` | Líneas añadidas o modificadas por la Pull Request respecto a su rama de destino |
| `$TEST_MANAGEMENT` | `ninguna` — los casos de prueba son los `#### Scenario:` de OpenSpec |

Ver `quality-gates.md`.

## 6 · Seguridad

| Variable | Valor |
|---|---|
| `$DAST_TOOL` | Análisis DAST asistido por IA: el agente `security` de Claude Code prueba la aplicación en ejecución en `DES`. Sin herramienta comercial |
| `$SECRETS_MANAGER` | Google Secret Manager en ejecución; secretos de GitHub Actions por entorno solo para la CI, con autenticación a Google Cloud por Workload Identity Federation (sin claves JSON) |
| `$AUTH_MECHANISM` · `$NORMATIVA` · `$RBAC_MATRIX_DOC` | `⚠️ PENDIENTE` |

## 7 · Infraestructura

| Variable | Valor |
|---|---|
| `$CI_PROVIDER` | `GitHub Actions` |
| `$PIPELINE_DIR` | `.github/workflows` |
| `$ENVIRONMENTS` | `DES → PROD` (GitHub Environments con el mismo nombre) |
| `$ARTIFACT_REGISTRY` | Artefacto generado por el workflow de build: imagen en Artifact Registry (servicios) o artefacto del workflow (web estática y binarios móviles). Es el que se despliega en todos los entornos |
| `$APPROVAL_POLICY` | Aprobación manual obligatoria para producción: *required reviewers* en el GitHub Environment `PROD` |
| `$DEPLOY_TARGET` · `$CONTAINER_RUNTIME` · `$IAC_TOOL` · `$OBSERVABILITY` | `⚠️ PENDIENTE` |

Ver `pipelines.md`.

## 9 · Selección de modelo

En Claude Code, los agentes de `.claude/agents/` declaran `model: opus` o
`model: sonnet` en su cabecera según su capacidad.

| Capacidad | Modelo |
|---|---|
| Razonamiento alto | `opus` (Claude Opus) |
| Equilibrada | `sonnet` (Claude Sonnet) |
| Rápida | `haiku` (Claude Haiku) |

---

## Jerarquía de elementos de trabajo

```
Epic → Feature → Story → Task | Bug
```

`$TRACKER_HIERARCHY` = `Epic > Feature > Story > Task`

En GitHub todos son **issues**. El tipo se expresa con una etiqueta
(`tipo:epic`, `tipo:feature`, `tipo:story`, `tipo:task`, `tipo:bug`) y la
jerarquía con **sub-issues** nativos: cada elemento es sub-issue de su padre.

> Si el repositorio pasa a una organización con *issue types* habilitados, se
> pueden usar los tipos nativos en lugar de la etiqueta `tipo:`. Hasta
> entonces, la etiqueta es la fuente de verdad.

Etiquetas transversales: `openspec`, `cap:<capacidad>`, `change:<slug>` y
`disc:<disciplina>`. Las crea quien las necesita por primera vez, con
`gh label create <nombre> --force`.

## Ciclo de vida (`$TRACKER_LIFECYCLE`)

El estado de un issue es `open` o `closed`. El avance se refleja además en el
campo `Status` del Project (`Todo` · `In Progress` · `Done`). Las fechas reales
van en dos campos de fecha del Project: `Start date` y `End date`.

| Tipo | Al crear | Al empezar | Al terminar | Campo de inicio | Campo de fin |
|---|---|---|---|---|---|
| Epic | `open` · Status `Todo` | Status `In Progress` | `closed` (completed) · Status `Done` | `Start date` | — |
| Feature | `open` · Status `Todo` | Status `In Progress` | `closed` (completed) · Status `Done` | `Start date` | — |
| Story | `open` · Status `Todo` | Status `In Progress` | `closed` (completed) · Status `Done` | `Start date` | `End date` |
| Task | `open` · Status `Todo` | Status `In Progress` | `closed` (completed) · Status `Done` | `Start date` | `End date` |
| Bug | `open` · Status `Todo` | Status `In Progress` | `closed` (completed) · Status `Done` | `Start date` | `End date` |

Decisiones de esta adaptación:

- **Una Epic se cierra solo cuando no le quedan sub-issues abiertos** de ningún
  change. Si un change posterior amplía la capacidad, se **reabre**
  (`gh issue reopen`); no se crea otra Epic.
- **Epic y Feature no tienen fecha de fin.**
- **El Bug se cierra al corregirse** (prueba de regresión en verde). Si una
  persona tiene que verificarlo después, lo reabre.

## Campos de cada elemento (`$TRACKER_FIELDS`)

«Cuerpo» es el texto del issue. Los demás son campos del Project. Epic y Feature
no llevan campos adicionales.

| Tipo | Campo | Valor | Se escribe |
|---|---|---|---|
| Story | Cuerpo | `narrativa` y, debajo, `## Criterios de aceptación` con `escenarios` | al crear |
| Story | `Story Points` (número) | `trazabilidad`. Fibonacci: 1, 2, 3, 5, 8; 13 o más, divide el requisito | al crear |
| Story | `Priority` (selección) | `trazabilidad`. `P1` crítica · `P2` alta · `P3` media · `P4` baja | al crear |
| Story | `Sprint` (iteración) | `sprint` | al crear |
| Task | Cuerpo | `tarea` | al crear |
| Task | `Estimate (h)` (número) | `est`. Horas: 1, 2, 3, 5, 8, 13, 21; más de 21, divide la tarea | al crear |
| Task | Etiquetas | `disc` (como `disc:<disciplina>`) | al crear |
| Task | `Priority` (selección) | `prioridad-story` | al crear |
| Task | `Sprint` (iteración) | `sprint` | al crear |
| Task | `Real (h)` (número) | `real` | al terminar |
| Bug | `Sprint` (iteración) | `sprint` | al crear |

- Los campos del Project (`Status`, `Start date`, `End date`, `Story Points`,
  `Priority`, `Sprint`, `Estimate (h)`, `Real (h)`) **deben existir** en
  `$TRACKER_PROJECT` con esos nombres. Si falta alguno, para y pregunta: no se
  crean por iniciativa propia.
- Como referencia, las horas de las Tasks de una Story suman unas **6 h por Story
  Point**. Si se desvían mucho, revisa la estimación antes de crear.

| Nivel | Se asocia a |
|---|---|
| Rama | Story o Feature |
| Commit | Task o Bug, referenciado con `#<ID>` |
| Pull Request | Story o Feature, con `Refs #<ID>` en la descripción |

> ⚠️ **No uses palabras de cierre** (`Closes`, `Fixes`, `Resolves`) en la
> descripción de la Pull Request: GitHub cerraría los issues al fusionar en la
> rama por defecto, saltándose el cierre ordenado que hace el archivado del
> change. Usa siempre `Refs #<ID>`.

## Definición de terminado

| Momento | Condición |
|---|---|
| Task cerrada | Implementada + pruebas en verde + cobertura sobre código nuevo `>= $COVERAGE_THRESHOLD` |
| Pull Request lista para fusionar | Checks de GitHub Actions en verde + hallazgos de CodeRabbit atendidos + revisión de `$REVIEWER` |
| Story / Feature cerradas | Pull Request fusionada y change archivado |

## Revisión e integración

- Al menos **un** revisor humano (`$REVIEWER`), además de CodeRabbit.
- Estrategia de fusión: **squash** hacia `develop` y hacia `master`.
- La rama se **borra** tras la fusión (opción del repositorio *Automatically
  delete head branches*).

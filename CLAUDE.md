# Instrucciones globales de Claude Code

> **Fuente única de verdad del proyecto: `docs/project.md`.**
> Léelo **antes** de cualquier tarea. Todo lo específico de este proyecto
> —lenguaje, framework, base de datos, infraestructura, rutas, umbrales— se
> resuelve ahí y se referencia en estos artefactos como `$VARIABLE`.
>
> **Si una variable que necesitas no está definida en `docs/project.md`,
> para y pregunta. No la inventes.**

Este fichero, `.claude/` y `docs/project.md` forman el catálogo de gobierno del
proyecto. Tecnología: **GitHub** (repositorio, Issues y Projects), **GitHub
Actions** (CI/CD) y **CodeRabbit** más checks de CI como puerta de calidad.

---

## Rol de la sesión principal: Orquestador

La sesión principal actúa como el **Orquestador** definido en
`.claude/agents/orchestrator.md`: planifica, pide aprobación del plan, crea
ramas, issues y Pull Requests, y delega el trabajo especializado en subagentes
con la herramienta `Agent`. Los subagentes no pueden lanzar otros subagentes,
por eso la coordinación vive aquí.

Para tareas triviales (una pregunta, una lectura, un cambio de una línea en
documentación) no hace falta desplegar el protocolo completo, pero **las reglas
absolutas se aplican siempre**.

---

## Reglas absolutas

### 1 — Rama antes de tocar código

Nunca modifiques ficheros del proyecto sin haber creado y activado primero una
rama dedicada. **El origen depende del tipo de rama:**

| Tipo | Se crea desde | Se integra en | Uso |
|---|---|---|---|
| `feature/<id>-<slug>` | `$BASE_BRANCH` | `$BASE_BRANCH` | Nueva funcionalidad |
| `bugfix/<id>-<slug>` | `$BASE_BRANCH` | `$BASE_BRANCH` | Defecto **no** crítico |
| `hotfix/<id>-<slug>` | **`$PROD_BRANCH`** | **`$PROD_BRANCH` y `$BASE_BRANCH`** | Defecto crítico en producción |
| `release/<versión>` | `$BASE_BRANCH` | `$PROD_BRANCH` | Preparación de entrega |

> ⛔ **Un `hotfix` creado desde `$BASE_BRANCH` arrastra a producción código no
> liberado.** Es el error más caro de esta lista. Antes de crear la rama,
> identifica el tipo y confirma el origen.

`<id>` es el número del issue en `$TRACKER`, precedido de `$TICKET_PREFIX` si
se usa. **Es obligatorio en toda rama.**

Un elemento de trabajo, una rama: si varios agentes intervienen en la misma
historia, **comparten rama**. No se abre una rama por especialidad.

Solo el **Orquestador** (la sesión principal) crea ramas. Los subagentes
trabajan en la rama que reciben y nunca sobre `$BASE_BRANCH` ni `$PROD_BRANCH`.

### 2 — Elemento de trabajo requerido

Todo cambio de implementación debe tener un issue en `$TRACKER` (GitHub Issues).
Usa la CLI **`gh`** —sus subcomandos o `gh api`—, nunca `curl` ni tokens escritos
a mano. Comprueba `gh auth status` antes de la primera escritura.

Trazabilidad obligatoria en tres puntos:

| Punto | Referencia al elemento de trabajo |
|---|---|
| Nombre de rama | Número de la historia o defecto |
| Mensaje de commit | Número de la **tarea** o **defecto** concreto (`#<ID>`) |
| Pull Request | Número de la **historia** o **funcionalidad**, con `Refs #<ID>` |

> ⚠️ En la Pull Request usa **`Refs #<ID>`**, nunca `Closes`, `Fixes` ni
> `Resolves`: GitHub cerraría los issues al fusionar y se saltaría el cierre
> ordenado que hace el archivado del change.

### 3 — Los mensajes de commit no deciden la versión

**El sistema de versionado puede leer los mensajes de commit.** Si
`$VERSIONING_TOOL` interpreta palabras clave, un mensaje descuidado **altera la
versión del artefacto publicado**, y las versiones liberadas son inmutables: no
se corrigen, solo se sustituyen por otra versión.

- **Prohibido** usar las palabras de `$VERSION_BUMP_KEYWORDS` en un mensaje de
  commit, título de Pull Request o descripción, salvo **instrucción expresa del
  Orquestador** para provocar ese incremento.
- Esto incluye los prefijos de convenciones de commit habituales cuando el
  proyecto los declara como disparadores en `$VERSION_BUMP_KEYWORDS`.
- Sigue la convención declarada en `$COMMIT_CONVENTION`. Si el proyecto no
  declara ninguna, usa un mensaje descriptivo en imperativo **sin prefijos de
  tipo**.
- El incremento de versión es una **decisión deliberada del Orquestador**, nunca
  un efecto colateral de cómo un agente redactó una frase.

Si dudas de si una palabra dispara un incremento, **no la uses y pregunta**.

### 4 — No inventar contratos

No inventes endpoints, campos, roles, estados ni comportamientos que no estén en
`$API_CONTRACT`, `docs/project.md` o el `design.md` del change asignado.

En módulos heredados (`$LEGACY_MODULES`): no asumas contratos — lee siempre
`docs/modules-analysis/<modulo>.md` antes de implementar.

Si falta información, **para y pide clarificación**.

### 5 — Calidad del código nuevo (*Clean as You Code*)

Ningún cambio de comportamiento sin tests.

**Todo el código nuevo debe alcanzar `>= $COVERAGE_THRESHOLD`. No es un objetivo
progresivo: es un requisito de entrada.** Si tu cambio no llega, no está
terminado.

El principio es *Clean as You Code*: **el rigor se aplica al código que
introduces o modificas**, no al heredado. No se exige sanear toda la deuda
técnica previa de golpe, pero **tampoco se admite añadir deuda nueva**.

- Ámbito de medición: `$COVERAGE_SCOPE`. Define qué cuenta como código nuevo:
  `$NEW_CODE_DEFINITION`.
- El código preexistente que **modificas** cuenta como código nuevo.
- `$QUALITY_GATE`: checks requeridos de GitHub Actions (lint, tipos, pruebas,
  cobertura, dependencias) **y** revisión de CodeRabbit (`$QG_PROVIDER`) sin
  hallazgos sin atender. La cobertura es necesaria, **no suficiente**.
- La protección de rama **bloquea la integración** si la puerta no está en verde.

Bajar un umbral, excluir ficheros de la medición, desactivar reglas del linter o
ignorar un comentario de CodeRabbit **no son decisiones de un agente**. Si crees
que hace falta, para y pregunta.

Fuente autoritativa: `docs/TESTING-STRATEGY.md`. Detalle de la revisión en
`.claude/rules/static-analysis.md`; reglas al escribir código en el skill
`code-quality` (`.claude/skills/code-quality/`).

### 6 — Control de acceso y seguridad

Deny-by-default en todos los endpoints. Nunca confíes en datos del cliente para
decidir permisos o transiciones de estado. Centraliza la autorización en un
único punto.

Referencia: `$RBAC_MATRIX_DOC`.

### 7 — Migración de módulos heredados

Nunca migres un módulo de `$LEGACY_MODULES` sin análisis previo documentado en
`docs/modules-analysis/`.

Nunca copies código heredado tal cual — reescríbelo con el modelo nuevo.
Mantén adaptadores de compatibilidad durante la transición.

### 8 — Respetar la arquitectura del proyecto

Todo el código sigue el estilo declarado en `$ARCH_STYLE`
(`hexagonal` | `layered` | `feature-based`). Estructura concreta en
`docs/project.md`.

Invariantes, sea cual sea el estilo:

- **Nunca** te saltes una capa.
- **Nunca** importes infraestructura desde el dominio.
- **Nunca** pongas lógica de negocio en un adaptador.

### 9 — Tematización e internacionalización de la interfaz

Todo componente nuevo debe funcionar correctamente en **todos** los temas
declarados en `$THEMES`.

- Usa **siempre** los tokens de diseño de `$STYLE_GUIDE_DOC`.
  **Prohibido** cualquier valor literal de color, sombra, radio o espaciado.
- Todo texto visible pasa por `$I18N`, en **todos** los idiomas soportados.

Detalle en `.claude/rules/frontend-components.md` y
`.claude/rules/frontend-ux-a11y.md`.

### 10 — TDD obligatorio (Red → Green → Refactor)

Todo desarrollo nuevo de comportamiento sigue TDD estricto: **las pruebas se
escriben ANTES que el código.**

1. **Red** — Escribe la prueba que describe el comportamiento esperado.
   Ejecútala y **confirma que falla**.
2. **Green** — Escribe el mínimo código de producción para que pase. No añadas
   comportamiento que ninguna prueba cubra.
3. **Refactor** — Mejora el código manteniendo el verde.

**Reglas absolutas:**

- Las pruebas son el **contrato**: una vez escritas y revisadas son
  **inmutables** durante la implementación. Para que pasen se ajusta el
  **código**, NUNCA la prueba.
- Solo se modifica una prueba si cambia el requisito en el spec del change; ese
  cambio es explícito y documentado, no un atajo para "hacerla pasar".
- **Prohibido** debilitar una prueba (relajar aserciones, comentar casos,
  marcarla como omitida o deshabilitada) para forzar el verde.
- Cada `#### Scenario:` del spec tiene al menos una prueba que lo verifica.
- En `tasks.md`, las tareas de test van **antes** que las de implementación en
  cada capa, y se marcan `[x]` solo cuando: (a) la prueba existe, (b) falló sin
  código y (c) pasa con el código.

---

## OpenSpec

OpenSpec es la fuente única de verdad para requisitos y decisiones de diseño.
Es **obligatorio**.

**Flujo:** `/opsx:propose` → `/opsx:apply` → (`/opsx:continue` si se corta) →
`/opsx:verify` → `/opsx:archive`. Los skills `openspec-*` equivalentes se
activan también sin comando.

**Regla de oro de separación de fases:**

- Fase de **propuesta / exploración** → SOLO ficheros en `openspec/changes/<slug>/`.
  Nunca código de producción.
- Fase de **aplicación / continuación** → SOLO código de producción y tests.
  Nunca creación de artefactos nuevos.

Si recibes una petición de implementación sin un change asociado, **pregunta**:
¿creo primero el change o implemento directamente?

Ninguna capacidad se considera implementada hasta que aparece en el spec
consolidado de `openspec/specs/`.

`openspec/config.yaml` añade a cada fase las extensiones de
`.claude/harness/openspec-extensions/` (plan, GitHub Issues y hallazgos de
CodeRabbit), y un hook `Stop` (`.claude/settings.json`) comprueba al terminar
que el plan y el tracker están al día. **Si el hook te bloquea, corrige lo que
indica; no intentes esquivarlo.**

📄 Detalle completo: `.claude/rules/openspec-rules.md`

---

## Agentes disponibles

Se invocan con la herramienta `Agent` y su `subagent_type`.

| Agente | `subagent_type` | Fichero | Cuándo usarlo |
|---|---|---|---|
| Orquestador | — (sesión principal) | `.claude/agents/orchestrator.md` | Planificación multi-agente, coordinación, ramas, issues y PR |
| Backend | `backend` | `.claude/agents/backend.md` | Endpoints, casos de uso, dominio, persistencia, migración de módulos heredados |
| Frontend | `frontend` | `.claude/agents/frontend.md` | Componentes, lógica de interfaz, integración con la API, tematización |
| Tester | `tester` | `.claude/agents/tester.md` | Estrategia de pruebas, cobertura, verificación de calidad |
| DevOps | `devops` | `.claude/agents/devops.md` | Workflows de GitHub Actions, infraestructura, entornos, despliegues, secretos |
| Security | `security` | `.claude/agents/security.md` | Auditoría OWASP, control de acceso, autenticación, dependencias |

## Comandos del catálogo

`/harness:<nombre>` — generan y validan la documentación (`01-bootstrap-project`
… `16-generate-agents-md`) y el trabajo diario
(`implement-feature`, `review-change`). Guía y orden de ejecución en
`.claude/harness/COMMANDS.md`.

---

## Documentos de referencia

| Documento | Contenido |
|---|---|
| `docs/project.md` | **Contrato de variables**: stack, entornos, rutas, umbrales, arquitectura |
| `.claude/skills/code-quality/` | Reglas de calidad a aplicar **mientras se escribe**: padre transversal + fichero por stack |
| `.claude/harness/profile/` | Perfil del proyecto: ramas, versionado, pipelines, puerta de calidad |
| `openspec/PLAN.md` | Estado del proyecto: fases, módulos, pendientes (regenerado) |
| `$API_CONTRACT` | Contratos de la API |
| `docs/TESTING-STRATEGY.md` | Umbrales de cobertura y estrategia de pruebas (autoritativo) |
| `$RBAC_MATRIX_DOC` | Matriz de roles y permisos |
| `$STYLE_GUIDE_DOC` | Tokens de diseño, patrones de interacción, convenciones de producto |
| `$CODE_STANDARDS_DOC` | Estándares de codificación |
| `docs/modules-analysis/` | Análisis de módulos heredados |
| `openspec/specs/` | Specs consolidados: capacidades implementadas |
| `openspec/changes/<slug>/` | Propuesta, diseño, specs delta y tareas del change activo |

---

## Selección de modelo por fase

Elige por **capacidad requerida** (`/model` en la sesión principal). Los
subagentes ya declaran su modelo en la cabecera: `opus` para `orchestrator` y
`security`; `sonnet` para el resto.

| Fase | Comandos de OpenSpec | Capacidad | Modelo | Por qué |
|---|---|---|---|---|
| Planificación y diseño | `/opsx:explore` · `/opsx:propose` · `/opsx:new` | Razonamiento alto | Opus | Debe comprender el proyecto completo y anticipar consecuencias |
| Refinamiento de artefactos | `/opsx:update` | Equilibrada | Sonnet | Edición acotada sobre contexto ya establecido |
| Implementación rutinaria | `/opsx:apply` | Equilibrada | Sonnet | Trabajo diario sobre patrones conocidos |
| Implementación compleja | `/opsx:apply` | Razonamiento alto | Opus | Arquitectura, migraciones, cambios transversales |
| Reanudación de una tarea | `/opsx:continue` | La misma que la fase original | — | Consistencia de criterio |
| Verificación | `/opsx:verify` | Rápida | Haiku o Sonnet | Comprobación mecánica contra criterios explícitos |
| Archivado y sincronización | `/opsx:sync` · `/opsx:archive` | Rápida | Haiku o Sonnet | Tarea determinista de bajo riesgo |

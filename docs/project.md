# `docs/project.md` — Contrato de variables del proyecto

> Valores del perfil de Habitinder: GitHub, GitHub Actions, CodeRabbit y Claude
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
| `$PROJECT_NAME` | `⚠️ PENDIENTE` |
| Organización | `⚠️ PENDIENTE` |
| `$PROJECT_DESCRIPTION` | `⚠️ PENDIENTE` |
| Versión de esta plantilla | `harness v1.2.0` |
| Última actualización | `⚠️ PENDIENTE` |

### Comandos transversales

Los que ejecuta cualquiera que se siente ante el repositorio, sin importar la
capa. Deben funcionar **desde la raíz**; si cada capa tiene el suyo, indícalos
todos con su directorio de trabajo.

| Variable | Valor | Ejemplo |
|---|---|---|
| `$INSTALL_CMD` | `⚠️ PENDIENTE` | Instalación de dependencias |
| `$RUN_CMD` | `⚠️ PENDIENTE` | Arranque en local |
| `$LINT_CMD` | `⚠️ PENDIENTE` | Análisis estático y formato, o `N/A` |

**Aplicabilidad de las secciones:**

| Sección | ¿Aplica? | Justificación |
|---|---|---|
| Servidor | sí / no | |
| Cliente | sí / no | |
| Persistencia | sí / no | |
| Infraestructura y despliegue | sí / no | |
| Módulos heredados | sí / no | |

> Si una sección no aplica, **elimina también los artefactos correspondientes**
> de `.claude/agents/` y `.claude/rules/`. No dejes reglas huérfanas.

---

## 1 · Repositorio y gestión de trabajo

| Variable | Valor | Valores admitidos / ejemplo |
|---|---|---|
| `$REPO_ROOT` | `⚠️ PENDIENTE` | Ruta absoluta a la raíz del repositorio |
| `$VCS_PROVIDER` | `github` | `azure-devops` · `github` · `gitlab` · `bitbucket` |
| `$REPO_ID` | `lcasadov/Habitinder` | Identificador del repositorio en el proveedor |
| `$BASE_BRANCH` | `develop` | Rama de integración: `develop` · `main` · `master` |
| `$PROD_BRANCH` | `master` | Rama de producción: `main` · `master`. Origen de los `hotfix` |
| `$LINKED_REPOS` | `ninguno` | Solo topología `multirepo`. Repositorios enlazados que comparten rama con este (ruta o nombre del submódulo), separados por coma. `ninguno` desactiva la rama espejo |
| `$TRACKER` | `github-issues` | `azure-devops` · `github-issues` · `jira` · `linear` · `ninguno` |
| `$TRACKER_ORG` | `lcasadov` (cuenta personal de GitHub) | Organización o cuenta en el gestor |
| `$TRACKER_PROJECT` | `2` — Project «Habitinder» (https://github.com/users/lcasadov/projects/2), enlazado al repositorio. Id GraphQL `PVT_kwHOAGwvnc4BnofG` | Proyecto o tablero |
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
| Estrategia de versionado | `⚠️ PENDIENTE` |
| ¿El versionado lee los mensajes de commit? | `⚠️ PENDIENTE` |
| Palabras que provocan incremento mayor | `⚠️ PENDIENTE` |
| Palabras que provocan incremento menor | `⚠️ PENDIENTE` |
| Palabras que provocan incremento de parche | `⚠️ PENDIENTE` |
| Fichero de configuración del versionado | `⚠️ PENDIENTE` |

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
| `$ARCH_STYLE` | `⚠️ PENDIENTE` | `hexagonal` · `layered` · `feature-based` |

**Estructura de directorios y reglas de dependencia:**

```
⚠️ PENDIENTE — árbol real del proyecto con el rol de cada capa
```

**Invariantes** (obligatorios en cualquier estilo):

- Nunca saltarse una capa
- Nunca importar infraestructura desde el dominio
- Nunca lógica de negocio en un adaptador

---

## 3 · Servidor

| Variable | Valor | Ejemplo |
|---|---|---|
| `$LANGUAGE` | `⚠️ PENDIENTE` | Lenguaje y versión |
| `$FRAMEWORK` | `⚠️ PENDIENTE` | Framework principal y versión |
| `$BUILD_TOOL` | `⚠️ PENDIENTE` | Herramienta de construcción |
| `$SRC_ROOT` | `⚠️ PENDIENTE` | Raíz del código de servidor |
| `$BUILD_VERIFY_CMD` | `⚠️ PENDIENTE` | Comando que compila y verifica |
| `$TEST_CMD` | `⚠️ PENDIENTE` | Comando de la suite de pruebas |

### Persistencia

| Variable | Valor | Ejemplo |
|---|---|---|
| `$DB` | `⚠️ PENDIENTE` | Motor de datos y versión |
| `$ORM` | `⚠️ PENDIENTE` | Capa de acceso a datos, o `ninguno` |
| `$MIGRATION_TOOL` | `⚠️ PENDIENTE` | Herramienta de migraciones de esquema |

### Módulos heredados

| Variable | Valor |
|---|---|
| `$LEGACY_MODULES` | `⚠️ PENDIENTE` o `N/A` |

> Lista los módulos que **no** deben tocarse sin un análisis previo en
> `docs/modules-analysis/<modulo>.md`. Si no hay código heredado, `N/A`.

---

## 4 · Cliente

| Variable | Valor | Ejemplo |
|---|---|---|
| `$UI_FRAMEWORK` | `⚠️ PENDIENTE` | Framework de interfaz y versión |
| `$UI_LIBRARY` | `⚠️ PENDIENTE` | Librería de componentes, o `ninguna` |
| `$BUNDLER` | `⚠️ PENDIENTE` | Empaquetador o herramienta de construcción |
| `$FRONTEND_ROOT` | `⚠️ PENDIENTE` | Raíz del código de cliente |
| `$STATE_MANAGEMENT` | `⚠️ PENDIENTE` | Gestión de estado global |
| `$HTTP_CLIENT` | `⚠️ PENDIENTE` | Cliente de red configurado |
| `$TYPECHECK_CMD` | `⚠️ PENDIENTE` | Comando de comprobación de tipos, o `N/A` |

### Presentación

| Variable | Valor | Ejemplo |
|---|---|---|
| `$THEMES` | `⚠️ PENDIENTE` | Lista de temas soportados, con el predeterminado marcado |
| `$STYLE_GUIDE_DOC` | `⚠️ PENDIENTE` | Ruta al documento de tokens y patrones |
| `$I18N` | `⚠️ PENDIENTE` | Sistema, idiomas soportados y ruta de recursos |
| `$A11Y_LEVEL` | `⚠️ PENDIENTE` | Nivel de accesibilidad exigido |
| `$BROWSER_MATRIX` | `⚠️ PENDIENTE` | Navegadores y versiones mínimas soportadas |

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
| `$COVERAGE_CMD` | `⚠️ PENDIENTE` | Comando que genera el informe |
| `$QG_PROVIDER` | `CodeRabbit` (revisión automática de Pull Requests en GitHub) | Herramienta de análisis estático y puerta de calidad |
| `$QUALITY_GATE` | Checks de GitHub Actions (lint, tipos, pruebas y cobertura) en verde **y** revisión de CodeRabbit sin conversaciones abiertas, exigidos por la protección de rama de `$BASE_BRANCH` y `$PROD_BRANCH` (aplicada también a administradores) | Nombre de la puerta aplicada y criterio de bloqueo |
| `$QG_LEVEL` | `N/A` — ver `.claude/harness/profile/quality-gates.md` | Nivel o perfil asignado al proyecto, si aplica |
| `$CODE_STANDARDS_DOC` | `⚠️ PENDIENTE` | Ruta a los estándares de codificación |
| `$TEST_FRAMEWORKS` | `⚠️ PENDIENTE` | Marcos de prueba por nivel |
| `$TEST_UNIT_CMD` | `⚠️ PENDIENTE` | Comando de pruebas unitarias |
| `$TEST_INTEGRATION_CMD` | `⚠️ PENDIENTE` | Comando de pruebas de integración |
| `$TEST_E2E_CMD` | `⚠️ PENDIENTE` | Comando de pruebas de extremo a extremo |
| `$PROPERTY_TESTING_LIB` | `⚠️ PENDIENTE` | Librería de pruebas basadas en propiedades, o `ninguna` |
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
| `$AUTH_MECHANISM` | `⚠️ PENDIENTE` | Mecanismo de autenticación y modelo de sesión |
| `$ACCESS_SEGREGATION_MODEL` | `⚠️ PENDIENTE` | Modelo de segregación: por rol, organización, ámbito… |
| `$RBAC_MATRIX_DOC` | `⚠️ PENDIENTE` | Ruta a la matriz de roles y permisos |
| `$NORMATIVA` | `⚠️ PENDIENTE` | Marcos normativos aplicables, o `ninguno` |
| `$DATOS_CATEGORIA_ESPECIAL` | `⚠️ PENDIENTE` | ¿Se tratan datos sensibles? Cuáles |
| `$LOG_RETENTION` | `⚠️ PENDIENTE` | Retención de registros de auditoría |
| `$EXPOSES_WEB_UI` | `⚠️ PENDIENTE` | `sí` / `no` — activa las comprobaciones de seguridad web |
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
| `$DEPLOY_TARGET` | `⚠️ PENDIENTE` | Destino de despliegue |
| `$CONTAINER_RUNTIME` | `⚠️ PENDIENTE` | Runtime de contenedores, o `ninguno` |
| `$ARTIFACT_REGISTRY` | Artefacto generado por el workflow de build de GitHub Actions: imagen en Artifact Registry (servicios) o artefacto del workflow (web y móvil). Es el que se despliega en todos los entornos | Registro de artefactos |
| `$SECRETS_MANAGER` | Google Secret Manager en ejecución; secretos de GitHub Actions por environment solo para la CI, con Workload Identity Federation | Gestor de secretos |
| `$IAC_TOOL` | `⚠️ PENDIENTE` | Infraestructura como código, o `ninguna` |
| `$APPROVAL_POLICY` | Aprobación manual obligatoria para producción: *required reviewers* en el GitHub Environment `PROD` | Qué entornos exigen aprobación manual |
| `$OBSERVABILITY` | `⚠️ PENDIENTE` | Registro, métricas y trazas |

> **Ningún secreto se escribe en este fichero.** Solo la referencia al gestor y
> el nombre lógico de cada secreto.

---

## 8 · Especificación y contratos

| Variable | Valor | Ejemplo |
|---|---|---|
| `$OPENSPEC_PATH` | `openspec` | Raíz de los artefactos OpenSpec |
| `$API_CONTRACT` | `⚠️ PENDIENTE` | Ruta al contrato de la API |

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

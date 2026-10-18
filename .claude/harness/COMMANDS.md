# Comandos del catálogo en Claude Code

> Los prompts del catálogo se invocan en Claude Code como comandos
> `/harness:<nombre>` (por ejemplo `/harness:01-bootstrap-project`). Lo que
> escribas detrás del comando les llega como contexto adicional. Los de OpenSpec
> son `/opsx:<fase>`.

# Prompts

Comandos reutilizables que **generan y validan la documentación** de la que
dependen los agentes.

Los prompts numerados están ordenados por **secuencia de ejecución**: cada uno
consume lo que produjeron los anteriores. Los no numerados son de trabajo
diario.

## Paso previo: inicializar OpenSpec

OpenSpec ya está inicializado en este proyecto (`openspec/`) con soporte para
Claude Code. Requiere la CLI `openspec` instalada en la máquina
(`openspec --version`). Ver
[`openspec-extensions/README.md`](openspec-extensions/README.md).

Antes del prompt 11, la estructura de OpenSpec debe existir, creada con el
**comando de inicialización de la propia herramienta**:

```
openspec init --tools claude
```

Ningún prompt la genera a mano: una estructura creada por otra vía diverge de la
que la herramienta espera y el ciclo de changes deja de funcionar.

## Secuencia de arranque

| # | Prompt | Produce |
|---|---|---|
| 01 | `bootstrap-project` | `docs/project.md` — **el contrato** |
| 02 | `audit-project` | contrato sin lagunas bloqueantes |
| 03 | `generate-product-doc` | `docs/product.md` |
| 04 | `generate-architecture` | `docs/architecture.md` |
| 05 | `generate-data-model` | `docs/datamodel.md` |
| 06 | `generate-api-contract` | `$API_CONTRACT` |
| 07 | `generate-rbac-matrix` | `$RBAC_MATRIX_DOC` |
| 08 | `generate-testing-strategy` | `docs/TESTING-STRATEGY.md` |
| 09 | `generate-code-standards` | `$CODE_STANDARDS_DOC` |
| 10 | `generate-style-guide` | `$STYLE_GUIDE_DOC` |
| 11 | `reverse-engineer-specs` | Specs consolidados de lo ya implementado |
| 12 | `generate-backlog` | `docs/backlog.md` |
| 13 | `analyze-legacy-module` | `docs/modules-analysis/<módulo>.md` |
| 14 | `validate-docs` | `docs/validacion.md` + correcciones |
| 15 | `verify-contract` | Informe de aptitud |
| 16 | `generate-agents-md` | `AGENTS.md` en la raíz del proyecto destino |

## Trabajo diario

| Prompt | Cuándo |
|---|---|
| `implement-feature` | Implementar un cambio de principio a fin |
| `review-change` | Revisar un conjunto de cambios antes de integrarlo |

## Entregables

Generan documentos Word con la **plantilla de Habitinder**. Se ejecutan cuando se necesita
el entregable, no en la secuencia de arranque, aunque dependen de que el contrato esté
cerrado: la portada, la ficha y el pie salen de `docs/project.md`.

| Comando | Produce | Plantilla |
|---|---|---|
| `entregable-documento-funcional` | Documento funcional: qué hace el sistema, para quién y con qué reglas | `documento-funcional.docx` |
| `entregable-documento-arquitectura` | Documento de arquitectura: C4, datos, seguridad, despliegue y decisiones | `documento-arquitectura.docx` |
| `entregable-informe-seguridad-primera-emision` | Informe SAST y SCA de un sistema sin informe previo | `informe-seguridad-primera-emision.docx` |
| `entregable-informe-seguridad-reemision` | Informe SAST y SCA que contrasta con la verificación anterior | `informe-seguridad-reemision.docx` |

Los cuatro enlazan [`entregables-formato.md`](entregables-formato.md), que define lo común:
cómo usar la plantilla y sus marcadores, cómo generar el Word y cómo verificarlo. Salen a
`docs/entregables/`.

Las plantillas están en `.claude/harness/profile/entregables/` (valores visuales en su
`formato.md`) y **traen ya montada la estructura de capítulos** de su comando, con el índice.

**La estructura de cada entregable se declara una sola vez, en su comando**: los bloques
`ficha`, `aprobacion` e `indice` del apartado «Estructura del documento».
`.claude/harness/scripts/build-entregables.py` genera las plantillas a partir de ellos; si
cambias un índice, regenéralas.

## Cómo se encadenan

```
                    openspec init
                          │
01 ──► 02 ──┬─► 03 ─► 04 ─► 05 ─► 06 ─► 07 ─► 08 ─► 09 ─► 10 ─► 11 ─► 12
            │                                                          │
            └─► 13  (solo si hay $LEGACY_MODULES)                      │
                                                                       ▼
                                                                14 ──► 15 ──► 16
```

El **01** y el **02** son obligatorios y van primero: sin contrato, ningún otro
prompt sabe contra qué trabajar. El resto puede saltarse cuando no aplique —el
10 no tiene sentido sin interfaz de usuario, el 13 solo si hay código
heredado—, pero cada documento omitido debe quedar marcado `N/A` en el contrato.

El **15** se repite cada vez que cambia `docs/project.md` o se toca un artefacto
de `.claude/` o `CLAUDE.md`.

El **16** va el último a propósito: genera el `AGENTS.md` del proyecto, que se
carga en **cada** interacción y contiene comandos que hay que **ejecutar** para
verificarlos. Antes del 15 ni el contrato está cerrado ni los comandos son
fiables.

## Las dos separaciones que sostienen todo esto

### Contrato frente a producto

```
docs/project.md   →  CONTRATO técnico. Variables. Lo leen los agentes.
docs/product.md   →  Visión, mercado, casos de uso. Lo leen las personas.
```

**Ningún prompt escribe prosa de producto en `docs/project.md`.** Un agente que
busca `$COVERAGE_CMD` y encuentra un diagrama de modelo de negocio no falla:
sigue adelante sin el dato.

### Backlog frente a spec

```
docs/backlog.md        →  QUÉ construir y en qué orden. Historias, prioridad.
openspec/.../spec.md   →  CÓMO sabremos que está bien. Requirement + Scenario.
```

**Los criterios de aceptación en Given/When/Then viven únicamente en los
specs.** Dos fuentes de criterios divergen siempre: una se corrige y la otra no,
y entonces nadie sabe cuál manda. El spec es el que las pruebas verifican, así
que es el único que puede ser autoritativo.

Por el mismo motivo, el registro de tareas de un cambio es
`$OPENSPEC_PATH/changes/<slug>/tasks.md` y **no hay ficheros de plan paralelos**.

## Reglas comunes a todos los prompts

| Regla | Motivo |
|---|---|
| No inventar | Un valor falso no produce un error, produce código incorrecto en silencio |
| Marcar el origen | Un valor deducido y uno confirmado no valen lo mismo |
| Preguntar antes de decidir | Lo que llega sin resolver requiere criterio humano, no más deducción |
| El código manda sobre el README | El README declara intenciones; el código describe hechos |
| Una pregunta cada vez | Una lista de preguntas se responde a medias o no se responde |

## Añadir un prompt

- Nómbralo `NN-verbo-objeto.prompt.md` si pertenece a la secuencia de arranque;
  `verbo-objeto.prompt.md` si es de trabajo diario; `entregable-objeto.md` si genera un
  documento Word.
- Incluye front-matter con `description` y `agent`.
- Declara **entradas**, **salida** y **prohibiciones**. Un prompt sin
  prohibiciones acaba inventando.
- Usa las variables del contrato, nunca tecnologías concretas. Si necesitas una
  clave que no existe, añádela primero a `docs/project.template.md`.
- **No dupliques lo que ya hace la herramienta OpenSpec.** El ciclo de propuesta,
  aplicación, verificación y archivado es suyo; los prompts cubren lo que ella no
  hace.

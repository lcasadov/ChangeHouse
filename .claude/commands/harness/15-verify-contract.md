---
description: "15 · Verificación mecánica final: cruza las variables usadas por los artefactos con las definidas en docs/project.md y comprueba que existe todo lo referenciado."
argument-hint: "[contexto opcional]"
---

# 15 · Verificación del contrato

Verificación **mecánica** de que la instalación del catálogo está completa. No
requiere criterio: o cuadra, o no cuadra.

Ejecútala tras instalar el catálogo, tras cambiar `docs/project.md` y antes de
dar por buena una sesión de documentación.

## Comprobación 0 — Instalación del catálogo

El catálogo vive en `CLAUDE.md` y `.claude/`, y se mantiene a mano: no hay CLI
que lo instale ni lo regenere. Informa de:

- Que existen los artefactos: `CLAUDE.md`, `.claude/agents/`, `.claude/rules/`,
  `.claude/commands/harness/`, `.claude/skills/`, `.claude/harness/` y
  `.claude/settings.json`.
- Referencias a rutas que no existen dentro de `.claude/` o `CLAUDE.md`: son
  enlaces rotos.

## Comprobación 1 — Variables

Extrae todos los identificadores de variable —el símbolo de dólar seguido de un
nombre en mayúsculas y guiones bajos— de:

```
.claude/agents/*.md
.claude/rules/*.md
.claude/commands/harness/*.md
CLAUDE.md
AGENTS.md
```

Y compáralos con los definidos en `docs/project.md`.

| Resultado | Significado | Gravedad |
|---|---|---|
| Usada y no definida | **Hueco.** Un agente encontrará una variable sin valor | 🔴 |
| Definida y no usada | **Sobrante.** O falta un artefacto, o la clave es residuo | 🟡 |

Excluye las que sean metasintaxis o variables de ejemplo dentro de fragmentos de
script; enumera cuáles has excluido y por qué.

## Comprobación 2 — Estado de las claves

Recuento y detalle de: valores firmes · `⚠️ SUPUESTO` · `⚠️ PENDIENTE` · `N/A` ·
**en blanco**.

Una clave **en blanco** es siempre un error: es indistinguible de un olvido.

## Comprobación 3 — Documentos referenciados

Todo documento citado por un artefacto o por `docs/project.md` debe existir:

`docs/TESTING-STRATEGY.md` · `$RBAC_MATRIX_DOC` · `$STYLE_GUIDE_DOC` ·
`$CODE_STANDARDS_DOC` · `$API_CONTRACT` · `$OPENSPEC_PATH` y cualquier otro.

Marca los ausentes y **qué prompt los genera**.

## Comprobación 4 — Ámbito de las instructions

Cada fichero de `.claude/rules/` declara sus `paths` en el frontmatter (salvo
las reglas globales, que no los declaran). Comprueba que **cada patrón encuentra
al menos un fichero** en el repositorio.

Un patrón de `paths` que no casa con nada es una regla que nunca se aplicará, y nadie se
enterará. Es el fallo silencioso más común al instalar el catálogo, porque los
patrones son literales y no admiten variables.

## Comprobación 5 — Residuos de otro proyecto

Busca en `CLAUDE.md` y `.claude/` menciones a nombres de producto, empresa, personas, rutas
absolutas o tecnologías concretas que deberían estar en `docs/project.md`.

Los artefactos contienen **reglas**; los valores viven en el contrato. Una
tecnología nombrada en una regla es una regla que solo sirve a un proyecto.

## Comprobación 6 — Estructura de OpenSpec

`$OPENSPEC_PATH` debe existir y estar bien formado:

- Las carpetas `specs/` y `changes/` existen.
- `specs/` **no está vacío**. Si lo está en un proyecto con código, la instalación
  está incompleta: falta ejecutar el prompt 11.
- Cada capacidad de `specs/` aparece en el índice y en el estado consolidado.
- Ningún change activo lleva marcadas todas sus tareas sin haberse archivado.
- Ningún fichero de `specs/` consolidado contiene cabeceras de delta.

Si la estructura no existe, indica que debe crearse con el comando de
inicialización de OpenSpec, **no a mano**.

## Comprobación 7 — Coherencia con el perfil

Si hay perfil (sus documentos están en `.claude/harness/profile/`), comprueba que ningún valor de
`docs/project.md` **relaja** lo que el perfil exige, en especial umbrales de
calidad, ramas y política de aprobación.

## Comprobación 8 — Extensiones de OpenSpec

Sin ellas, OpenSpec funciona pero ni el plan ni `$TRACKER` se mantienen, y nadie
lo nota hasta que alguien busca el trabajo y no está.

- `$OPENSPEC_PATH/config.yaml` contiene las claves de
  `.claude/harness/openspec-extensions/config.yaml` (`context`, `rules.proposal`,
  `rules.tasks`, `operations.apply`, `operations.archive`).
- `openspec instructions tasks --change <un change>` muestra esas reglas y
  **ningún aviso `Unknown`**. Si no hay changes, indícalo y omite esta línea.
- `.claude/settings.json` declara el hook `Stop` que ejecuta
  `.claude/hooks/openspec-sync-check.cjs`, y el script existe.
- `node .claude/hooks/openspec-sync-check.cjs --ci` termina con código `0`.
- Un workflow de GitHub Actions en `$PIPELINE_DIR` ejecuta esa misma
  comprobación.
- Los skills `.claude/skills/openspec-*` y los comandos `.claude/commands/opsx/*`
  existen y los genera `openspec init --tools claude` / `openspec update`.
- El `generatedBy` de los `SKILL.md` coincide con la versión de OpenSpec que
  fija el catálogo (campo `openspec` del lock). Si `openspec --version` es otra,
  es 🟡: funciona, pero conviene alinear la herramienta instalada.

## Salida

Informe en el chat, sin modificar ficheros:

```markdown
## Instalación
- Versión: <instalada> · <más reciente | actualizada>
- Modificados: <lista o "ninguno"> · Ausentes: <lista o "ninguno"> · Conflictos: <lista o "ninguno">
## Variables
- Huecos: <lista o "ninguno">
- Sobrantes: <lista o "ninguno">
- Total del contrato: <n>

## Estado de las claves
- Firmes <n> · Supuestos <n> · Pendientes <n> · N/A <n> · En blanco <n>

## Documentos ausentes
- <documento> → lo genera el prompt <n>

## Reglas sin alcance
- <fichero>: el patrón de `paths` <patrón> no casa con nada

## OpenSpec
- Estructura: <correcta | ausente | incompleta>
- Capacidades consolidadas: <n>
- Extensiones: <instaladas | incompletas: qué falta>
- Skills: <sin modificar, versión <v> | modificados | desactualizados>

## Residuos detectados
- <fichero:línea>: <hallazgo>

## Veredicto
<APTO | NO APTO> — <motivo en una línea>
```

**No corrijas nada.** Esta verificación solo informa; corregir es trabajo de los
prompts 02 y 14.


---

Contexto adicional del usuario: $ARGUMENTS

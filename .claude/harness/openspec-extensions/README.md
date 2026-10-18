# Extensiones de OpenSpec

Añaden a OpenSpec tres comportamientos que la herramienta no trae: regenerar
`$OPENSPEC_PATH/PLAN.md`, mantener la jerarquía de trabajo en `$TRACKER`
(Epic → Feature → Story → Task/Bug, con sus estados) y revisar, antes de
implementar, los hallazgos de `$QG_PROVIDER` en el último PR fusionado.

## Regla principal: no se modifica nada generado

Los `SKILL.md` de `.claude/skills/openspec-*/` y los comandos `.claude/commands/opsx/*` **los
genera la herramienta de OpenSpec** y los reescribe `openspec update` sin
avisar. Se ha comprobado: un bloque añadido a mano desaparece en la siguiente
actualización, sin conflicto ni diff que lo avise salvo en git.

Se usan **tal como los genera** `openspec`, sin tocarlos. Las extensiones,
por tanto, no pueden vivir dentro de ellos. Usan tres piezas que la herramienta
no regenera:

| Pieza | Qué hace | Por qué sobrevive a `update` |
|---|---|---|
| [`config.yaml`](config.yaml) → `openspec/config.yaml` | **Indica** al agente qué hacer en cada fase | Es configuración del proyecto; OpenSpec la lee y no la reescribe |
| `.claude/hooks/openspec-sync-check.cjs` + hook `Stop` de `.claude/settings.json` | **Comprueba** al terminar la sesión que se hizo | Es del espacio de trabajo, no de OpenSpec |
| `openspec-sync-check.cjs --ci` en GitHub Actions | **Última red** si el hook estaba desactivado | Vive en `.github/workflows/openspec-sync.yml` |

La lógica está en [`plan-sync.md`](plan-sync.md), [`tracker-sync.md`](tracker-sync.md)
y [`quality-sync.md`](quality-sync.md). Las tres piezas solo remiten a ellos.

## Cómo llega cada regla al agente

Los skills de OpenSpec llaman a `openspec instructions`, y su salida incluye lo que
declara `config.yaml`:

| Clave de `config.yaml` | Llega al agente en | Qué le pide |
|---|---|---|
| `context` | Todas las operaciones | Dónde están las extensiones; regenerar el plan al terminar |
| `rules.proposal` | Al redactar `proposal.md` | Sección `## Trazabilidad`: qué se crea y qué se reutiliza en `$TRACKER`, y Story Points y prioridad de cada Story |
| `rules.tasks` | Al crear `tasks.md` (propose, continue) | Identificadores estables, estimación y disciplina; crear la jerarquía con sus campos tras confirmación |
| `operations.apply` | Al implementar **y al verificar** | Revisión de hallazgos del último PR antes de la primera tarea; cambios de estado; Bugs por hallazgo bloqueante |
| `operations.archive` | Al archivar | Cierre de Stories y Feature; regenerar el plan |

`operations` solo admite `apply` y `archive`: otra clave produce un aviso y se
ignora. `verify` no tiene clave propia, pero lee las instrucciones de `apply`.

`config.yaml` **orienta**; no obliga. Por eso existe el hook.

## El hook de fin de sesión

`openspec-sync-check.cjs` se ejecuta en el evento `Stop`, cuando el agente va a
terminar. Si en esta sesión se ha tocado algún change y falta algo, **impide que
termine** y le dice qué corregir:

- El change no figura en `PLAN.md`, o su recuento `completadas/total` no coincide
  con `tasks.md`.
- Falta la sección `## Trazabilidad` en `proposal.md`.
- Hay tareas sin `tracker-links.json`, sin identificador en el gestor o sin
  padre. No exige niveles por nombre: vale para cualquier `$TRACKER_HIERARCHY`.
- Un change archivado no figura en el plan.

Comprueba contenido, no fechas de fichero, así que da el mismo resultado en local
y en CI. No escribe nada ni llama al gestor: la sincronización siempre la hace
el agente, con la CLI `gh` (ver `tracker-sync.md`).

**Protección contra bucles.** Bloquea **una sola vez**. Si el agente ya siguió
trabajando por culpa del hook (`stop_hook_active`), el segundo intento solo
muestra un aviso. Así, si el gestor no responde, la sesión no se queda
consumiendo créditos indefinidamente.

**Operaciones pendientes.** Si el gestor falló y la operación está registrada en
el array `pending` de `tracker-links.json`, el hook **solo avisa**: el trabajo
está registrado aunque no sincronizado. En CI, en cambio, bloquea.

Sin `openspec/`, o sin cambios en esta sesión, el hook no hace nada.

### En Claude Code

- El hook se declara en `.claude/settings.json` como hook `Stop` y ejecuta
  `node .claude/hooks/openspec-sync-check.cjs`. Su salida usa el formato de
  Claude Code: `{"decision": "block", "reason": ...}` para bloquear y
  `{"systemMessage": ...}` para avisar.
- Requiere Node en la máquina del desarrollador.
- Los hooks se pueden desactivar en local; por eso la comprobación en CI no es
  opcional.

## Instalación en este proyecto

El catálogo está adaptado a Claude Code y se mantiene a mano. Lo que leen los
agentes de Claude es:

| Pieza | Ubicación |
|---|---|
| Instrucciones globales | `CLAUDE.md` |
| Agentes | `.claude/agents/` |
| Reglas por ruta | `.claude/rules/` |
| Comandos del catálogo | `.claude/commands/harness/` (`/harness:<nombre>`) |
| Comandos y skills de OpenSpec | `.claude/commands/opsx/` y `.claude/skills/openspec-*` |
| Extensiones de OpenSpec | `.claude/harness/openspec-extensions/` (esta carpeta) |
| Perfil y plantillas | `.claude/harness/profile/` y `.claude/harness/templates/` |
| Hook de fin de sesión | `.claude/hooks/openspec-sync-check.cjs` + `.claude/settings.json` |

Los skills y comandos de OpenSpec los genera la propia herramienta:

```
openspec init --tools claude
openspec update
```

`openspec update` regenera `.claude/skills/openspec-*` y
`.claude/commands/opsx/*`; **no toca** `openspec/config.yaml`, que es donde
viven estas extensiones. No ejecutes `openspec init` de nuevo en un proyecto ya
inicializado.

La comprobación en CI está en `.github/workflows/openspec-sync.yml`:

```
node .claude/hooks/openspec-sync-check.cjs --ci
```

que sale con código `1` si algo está desincronizado y `0` si está al día.
Debe ser un check **requerido** en la protección de rama. Versiona todo en git,
`.claude/` incluido (salvo `.claude/settings.local.json`).

## Si algún día hace falta tocar un `SKILL.md` de OpenSpec

No lo hagas: `openspec update` lo sobrescribirá. Si una necesidad no cabe en
`openspec/config.yaml`, las alternativas por orden de preferencia son: ampliar
el hook, añadir una regla o un comando propios, o crear un esquema local con
`openspec schema fork` (experimental).

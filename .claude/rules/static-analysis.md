# Análisis estático y revisión automática (CodeRabbit)

Este proyecto **no tiene un analizador estático con servidor propio**. La puerta
de calidad (`$QUALITY_GATE`) se compone de:

| Control | Dónde actúa | Cómo se consulta |
|---|---|---|
| Linter y formato (`$LINT_CMD`) | Local y GitHub Actions | Ejecutando el comando |
| Comprobación de tipos (`$TYPECHECK_CMD`) | Local y GitHub Actions | Ejecutando el comando |
| Pruebas y cobertura (`$COVERAGE_CMD`, umbral `$COVERAGE_THRESHOLD`) | Local y GitHub Actions | Ejecutando el comando |
| Revisión automática de `$QG_PROVIDER` (CodeRabbit) | Pull Request en GitHub | `gh` (ver abajo) |

**No inventes herramientas ni simules un análisis.** Si un comando está
`⚠️ PENDIENTE` en `docs/project.md`, para y pregunta.

## Ciclo por tarea

1. **Al terminar de generar o modificar código**, ejecuta sobre lo que has
   tocado `$LINT_CMD`, `$TYPECHECK_CMD` y las pruebas afectadas. Es
   **obligatorio**: una tarea sin pasar por ellos no está terminada.
2. Si está instalada la CLI de CodeRabbit (`coderabbit --version` responde),
   ejecuta una revisión local de los cambios sin confirmar
   (`coderabbit review --plain`) y atiende los hallazgos antes de commitear. Si no
   está instalada, no la simules: la revisión llegará en la PR.
3. Corrige los hallazgos **antes** de dar la tarea por cerrada, o declara
   expresamente los que quedan abiertos y por qué.

## Revisión de CodeRabbit en la Pull Request

CodeRabbit comenta la PR como el usuario `coderabbitai[bot]`. Para leer sus
hallazgos usa **siempre `gh`**, nunca `curl`:

```bash
# Comentarios en línea (hallazgos sobre ficheros concretos)
gh api "repos/{owner}/{repo}/pulls/<PR>/comments" --paginate \
  --jq '.[] | select(.user.login=="coderabbitai[bot]") | {path, line, body}'
# Revisiones (resumen y estado: COMMENTED / CHANGES_REQUESTED / APPROVED)
gh api "repos/{owner}/{repo}/pulls/<PR>/reviews" \
  --jq '.[] | select(.user.login=="coderabbitai[bot]") | {state, body}'
```

- Un comentario de CodeRabbit **no se resuelve sin respuesta**: o se corrige, o
  se contesta en el hilo con la razón por la que no aplica.
- Tras corregir, **no des el hallazgo por cerrado mirando la PR antigua**: sube
  el commit y espera la nueva revisión, o vuelve a ejecutar la revisión local.
- Los hallazgos de **seguridad** se tratan por el cauce del agente `security`.

## Cierre del bucle — obligatorio

Un hallazgo corregido y olvidado se repite. Por eso la revisión no termina en la
corrección:

**Cuando un hallazgo era evitable y no es la primera vez que aparece, añade la
regla a `<stack>.local.md` en el mismo cambio que la corrección.** Es el fichero
de reglas propio del proyecto; `<stack>.md` viene del catálogo y no se edita. Ver
`.claude/skills/code-quality/SKILL.md`, sección «Cómo se mantiene vivo este
skill», que define qué entra, qué se retira y en qué formato.

Criterio de entrada, resumido: entra lo que ha bloqueado la puerta **al menos
dos veces**, o cuya corrección no se deduce del mensaje del linter o de
CodeRabbit. Lo que se entiende leyendo el aviso, no se documenta.

Nunca dejes la actualización del skill como tarea diferida. No se hace.

## Qué no hacer

- Bajar el umbral de cobertura, desactivar reglas del linter, añadir exclusiones
  de cobertura o ignorar un comentario de CodeRabbit para que la puerta pase. Si
  hay razón real para hacerlo, la decide una persona, se documenta y lleva fecha
  de revisión.
- Ejecutar el linter o las pruebas sobre un fragmento y darlo por equivalente a
  la ejecución completa que hará GitHub Actions.
- Reportar la tarea como terminada con hallazgos abiertos sin declararlos.

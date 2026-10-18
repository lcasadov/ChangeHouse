# Extensión · Hallazgos de calidad antes de implementar

Antes de tocar la primera tarea de una sesión de `apply`, repasa lo que
`$QG_PROVIDER` encontró en el **último PR fusionado hacia `$BASE_BRANCH`** y, si
alguno de esos hallazgos merece una regla permanente, añádela a
`<stack>.local.md`. El objetivo es que un error ya cometido no se repita en la
sesión que arranca, en vez de descubrirlo otra vez cuando el gate de *esta*
tarea se ponga en rojo.

Esta extensión mira **hacia atrás** (lo último que ya se integró); el cierre de
bucle de `.claude/rules/static-analysis.md` mira **hacia
delante** (los ficheros que acabas de tocar, antes de terminar). Son
complementarias: ejecutar esta no exime de la otra.

> Si `$QG_PROVIDER` no está instalado en el repositorio (no hay revisiones de
> `coderabbitai[bot]` en las Pull Requests), o `docs/project.md` no declara
> ningún stack, esta extensión no aplica. No inventes una herramienta ni un
> fichero de reglas para rellenarla.

## Cuándo se ejecuta

**Una vez, al principio de la sesión de `apply`** — al empezar a implementar la
primera tarea sin marcar de un change, tanto si se acaba de proponer como si se
retoma uno pausado. No en cada tarea, y no durante `verify`: verificar no
escribe código nuevo, así que no hay nada que esta revisión deba prevenir.

## Procedimiento

1. **Localiza el último PR fusionado** hacia `$BASE_BRANCH` (el más reciente por
   fecha de fusión, de cualquier rama de origen):
   `gh pr list --base <$BASE_BRANCH> --state merged --limit 1 --json number,title,mergedAt`.
   Si el repositorio no tiene ninguno todavía, no hay nada que revisar: anótalo
   y sigue con la implementación.
2. **Consulta los hallazgos de CodeRabbit** en ese PR, con `gh` y nunca `curl`:
   `gh api "repos/{owner}/{repo}/pulls/<PR>/comments" --paginate --jq '.[] | select(.user.login=="coderabbitai[bot]") | {path, line, body}'`
   y, para el resumen, el mismo filtro sobre `/pulls/<PR>/reviews`.
3. **Fíjate en cómo se cerró cada hallazgo**: corregido en un commit posterior
   del mismo PR, respondido con una razón, o ignorado. Los ignorados sin
   respuesta son, además, un aviso para el resumen de la sesión.
4. **Descarta**, sin convertirlos en regla:
   - Lo que ya cubre una regla existente en `<stack>.md` o `<stack>.local.md` —
     no dupliques.
   - **Hallazgos de seguridad** (vulnerabilidades, secretos, control de acceso). Nunca entran aquí: son
     competencia del agente `Security`. Si aparece alguno, menciónalo al
     terminar la sesión para que se revise por ese cauce, y sigue.
   - Cualquier hallazgo que solo haya aparecido una vez y cuya corrección se
     entienda leyendo el propio comentario de CodeRabbit. Es el mismo criterio de
     admisión de `.claude/skills/code-quality/SKILL.md`, sección «Cómo se mantiene vivo este skill»,
     no uno nuevo.
5. **Añade lo que sobreviva** al filtro a `<stack>.local.md` del stack que
   corresponda (infiere el stack por lenguaje o ruta del fichero afectado; si no
   coincide con ninguno de los declarados en `docs/project.md`, anótalo en vez
   de inventar un fichero nuevo), con el formato fijo de `.claude/skills/code-quality/SKILL.md`: qué
   hacer · por qué falla el gate · ejemplo incorrecto · ejemplo correcto.
6. **Si nada sobrevive al filtro, no toques ningún fichero.** Una línea en el
   resumen de la sesión indicando que no había nada nuevo que registrar basta;
   crear una regla para justificar el paso es peor que no darlo.

## Qué no hace esta extensión

- **No crea elementos en `$TRACKER`.** Los hallazgos del último PR ya
  pertenecen a un trabajo que se dio por cerrado; mezclarlos con la Feature del
  change actual confundiría de qué incumplimiento responde cada uno. La
  creación de Bugs por hallazgo sigue siendo solo la de `tracker-sync.md`,
  sección «Al verificar», y solo sobre el change que se está verificando.
- **No bloquea el cierre de la sesión.** Es una guía que el agente sigue por
  criterio, igual que el resto de `.claude/skills/code-quality/SKILL.md`; a diferencia de la
  sincronización de plan y tracker, no hay un hook que compruebe que se
  ejecutó.

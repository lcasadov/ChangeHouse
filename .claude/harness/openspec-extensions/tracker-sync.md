# Extensión · Sincronización con el gestor de trabajo

Mantiene la jerarquía de elementos de `$TRACKER` alineada con los artefactos de
OpenSpec, y su estado, sus campos y su sprint alineados con el avance real.

> Si `$TRACKER` vale `ninguno`, **omite esta extensión por completo**. No inventes
> un gestor ni sugieras crearlo.

## Mapeo

OpenSpec y los gestores de trabajo describen lo mismo con vocabularios distintos.
La correspondencia es:

| OpenSpec | Elemento de trabajo | Ciclo de vida |
|---|---|---|
| Capacidad (`$OPENSPEC_PATH/specs/<capability>/`) | Nivel 1 (**Epic**) | Sobrevive a los changes |
| Change (`$OPENSPEC_PATH/changes/<slug>/`) | Nivel 2 (**Feature**) | Nace y muere con el change |
| `### Requirement:` del spec delta | Nivel 3 (**User Story**) | Se cierra al cumplirse |
| Línea `- [ ]` de `tasks.md` | Nivel 4 (**Task**) | Refleja el avance diario |
| Hallazgo de `verify` o prueba en rojo | **Bug**, hijo de la Feature | Se cierra al corregirse |

Los nombres concretos de los niveles los declara `$TRACKER_HIERARCHY`: varían
entre procesos y organizaciones. No los deduzcas del ejemplo.

**La capacidad es Epic, y no el change.** Es la decisión que sostiene todo lo
demás: una capacidad vive años y recibe muchos changes, mientras que un change
dura semanas. Si mapeas el change a Epic, acabas con decenas de Epics de vida
corta y ninguna visión de qué hace el producto.

## Idempotencia

**Nada se crea sin comprobar antes si ya existe.** Un skill puede reejecutarse:
por un fallo de red, porque el usuario repite el comando, o porque una
regeneración perdió el estado. Sin control, cada reejecución duplica la jerarquía
entera, y limpiar duplicados en un gestor es trabajo manual que nadie hace.

La correlación se guarda en `$OPENSPEC_PATH/changes/<slug>/tracker-links.json`:

```json
{
  "tracker": "$TRACKER",
  "change": "<slug>",
  "sprint":  { "path": "<ruta de la iteración>", "created": false },
  "epic":    { "capability": "<capacidad>", "id": 0, "reused": false },
  "related_epics": [ { "capability": "<otra capacidad>", "id": 0 } ],
  "feature": { "id": 0, "reused": false },
  "stories": [ { "key": "<título del Requirement>", "id": 0, "reused": false } ],
  "tasks":   [ { "key": "<identificador de la tarea>", "id": 0, "parent": 0, "state": "" } ],
  "bugs":    [ { "key": "<hallazgo>", "id": 0 } ],
  "pending": []
}
```

`reused: true` marca un elemento que ya existía: **no se cierra al archivar el
change** salvo que el change lo haya completado, porque puede tener trabajo
ajeno. `parent` en cada tarea deja constancia de dónde quedó colgada, sea Story
nueva, existente o técnica. `sprint` registra la iteración donde se creó el
change y si la creó esta extensión.

Reglas:

- **Antes de crear, consulta el fichero.** Si la clave ya tiene identificador, se
  actualiza; no se crea.
- La clave de una tarea es su **identificador estable** en `tasks.md` (`B1`,
  `F2`, `T3`). Si las tareas no lo tienen, usa el texto normalizado y **avisa**:
  sin identificador, renombrar una tarea crea un duplicado.
- Este fichero **se versiona en git**. Es lo que permite que otra persona, u otra
  máquina, continúe el change sin duplicar nada.

## Estados y fechas

Los estados y los campos de fecha **dependen del proceso** del gestor y de su
personalización, y **cambian según el tipo** de elemento: en un mismo proyecto,
la Task puede terminar en `Closed` y el Bug en `Resolved`, y una Epic puede no
tener campo de fin.

Por eso nunca se escriben literales: se leen de la tabla `$TRACKER_LIFECYCLE` de
`docs/project.md`, que da, por tipo:

| Columna | Uso |
|---|---|
| Al crear | Estado con el que nace el elemento |
| Al empezar | Estado cuando empieza su trabajo |
| Al terminar | Estado cuando su trabajo acaba |
| Campo de inicio | Campo donde se registra la fecha real de inicio, o `—` |
| Campo de fin | Campo donde se registra la fecha real de fin, o `—` |

Reglas:

- Si el tipo que vas a tocar no tiene fila, o le falta un valor, **para y
  pregunta**. Un estado inventado falla al escribir, y el mensaje del gestor no
  siempre dice cuáles eran los válidos.
- Si el campo es `—`, **no escribas ninguna fecha** en ese tipo. En particular,
  no uses una fecha objetivo o planificada como fecha real.
- **La fecha de inicio se escribe una sola vez**: si el campo ya tiene valor
  (el elemento se reabrió, o se reutilizó), no se sobrescribe.
- La fecha de fin se escribe al terminar, con la fecha del día. Si el elemento se
  reabre, se vacía al volver a empezarlo y se reescribe al terminar de nuevo.
- Estado y fechas del mismo elemento van **en la misma actualización**. Por
  separado, un fallo intermedio deja un elemento terminado sin fecha, o con fecha
  y sin terminar.

## Campos de cada elemento

Además del estado y las fechas, cada tipo lleva los campos que declara la tabla
`$TRACKER_FIELDS` de `docs/project.md`: qué campo, de dónde sale su valor y
cuándo se escribe. Un elemento que nace sin ellos hay que completarlo a mano, y
en la práctica nadie lo hace: el sprint queda sin estimar y el tablero sin
filtrar.

Reglas:

- **Escribe todos los campos de su tipo, y solo esos.** Un campo que la tabla no
  declara no se toca, aunque el tipo lo tenga.
- **El valor sale de su origen; nunca se supone.** Si el origen no lo da (una
  tarea sin `est:`, una Story sin Story Points en la Trazabilidad), **para y
  pregunta** antes de crear. Si el elemento ya existe, registra el campo en
  `pending`.
- Los campos se escriben **al crear** el elemento. Si la herramienta no los
  admite al crear, en **una sola actualización inmediatamente después**, antes
  de pasar al siguiente nivel. Un elemento creado y sin campos es justo lo que
  hay que evitar.
- Un elemento **reutilizado** conserva sus valores: solo se rellenan los campos
  vacíos.
- Si el tipo no tiene un campo que la tabla declara, **para y pregunta**: la
  tabla no corresponde al proceso del gestor.
- Una **Story técnica** no tiene `### Requirement:`: su narrativa y sus
  escenarios salen de `proposal.md` y de las verificaciones de sus tareas, y su
  fila de la Trazabilidad lleva `(técnica)`.

La columna «Valor» de `$TRACKER_FIELDS` indica uno de estos orígenes:

| Origen | De dónde sale |
|---|---|
| `narrativa` | «Como <rol>, quiero <capacidad>, para <valor>.», seguida de **Objetivo**, **Alcance**, **Fuera de alcance** y **Evaluación INVEST**. Se redacta a partir del `### Requirement:` y de `proposal.md` |
| `escenarios` | Los `#### Scenario:` del `### Requirement:` de la Story, en GIVEN/WHEN/THEN |
| `tarea` | El texto de la línea de `tasks.md` y, debajo, **Criterios de aceptación**: entre uno y tres escenarios propios en GIVEN/WHEN/THEN, con el resultado concreto que comprueba esa tarea, no una repetición de los de su Story. En muchos procesos la Task no tiene campo de criterios: por eso van en la descripción |
| `trazabilidad` | La tabla de Stories de `## Trazabilidad` en `proposal.md`: Story Points y prioridad |
| `prioridad-story` | La prioridad de la Story de la que cuelga |
| `est` | El campo `est:` de la línea de `tasks.md`, en horas |
| `real` | El campo `real:` de la línea de `tasks.md`; si no lo tiene, el de `est:` |
| `disc` | El campo `disc:` de la línea de `tasks.md`, que debe ser una de `$TRACKER_DISCIPLINE_TAGS`. Se **añade** a las etiquetas |
| `sprint` | El sprint en curso, según la sección «Sprint» |
| `área` | El área por defecto de `$TRACKER_TEAM`. No aplica en GitHub |
| Un literal entre comillas | Ese valor, tal cual |

**Evaluación INVEST.** Cada dimensión se justifica con datos de esa Story; las
seis palabras solas no valen:

- **Independiente**: de qué depende, con referencia explícita, o por qué no depende de nada.
- **Negociable**: qué puede cambiar sin perder el valor.
- **Valiosa**: qué nota el rol cuando está hecha.
- **Estimable**: por qué el alcance permite dimensionarla.
- **Pequeña**: por qué cabe en un sprint.
- **Testable**: qué escenarios la verifican.

Si una Story no supera **Valiosa**, **Estimable** o **Testable**, no la crees:
el requisito necesita revisión. Avísalo y para.

**Los criterios de aceptación son una copia.** Manda el spec, porque es lo que
verifican las pruebas. Si un `#### Scenario:` cambia, el campo se regenera desde
el spec en la siguiente sincronización. **No se editan en el gestor**: una
corrección hecha allí se pierde en la siguiente sincronización.

## Sprint

Si `$TRACKER_SPRINT` vale `ninguno`, los elementos quedan en la iteración raíz
del proyecto y esta sección no aplica.

1. **Busca el sprint en curso**: la iteración del campo `Sprint` del Project
   cuya fecha de inicio es hoy o anterior y cuyo fin (inicio + duración) es
   posterior a hoy. Las iteraciones salen de `gh project field-list`; si no
   incluye sus fechas, consúltalas con `gh api graphql` sobre la
   configuración del campo de iteración (`ProjectV2IterationField`).
2. **Si no hay ninguna, no la crees.** Las iteraciones de GitHub Projects se
   configuran en los ajustes del Project y cambian el tablero de todos.
   Muéstralo en el árbol que se confirma antes de escribir y pide al usuario
   que añada la iteración con la duración y el nombre de `$TRACKER_SPRINT`.
3. Mientras tanto, crea los elementos **sin sprint** y registra la asignación
   de sprint en `pending` para completarla en la siguiente sincronización.

Solo llevan sprint los tipos para los que `$TRACKER_FIELDS` declara el origen
`sprint`: Epic y Feature suelen abarcar varios.

**Arrastre.** Al empezar una tarea cuya Task sigue en un sprint ya terminado,
muévela al sprint en curso, y con ella su Story si sigue abierta. Lo terminado
se queda en el sprint donde se terminó.

## Localizar lo existente

Antes de crear cualquier elemento, búscalo. En este orden:

1. **`tracker-links.json`** del propio change y de los demás changes, activos y
   archivados, de la misma capacidad.
2. **Etiquetas en `$TRACKER`.** Todo elemento que crea esta extensión lleva tres
   etiquetas: `openspec`, `cap:<capacidad>` y `change:<slug>`. Consulta por ellas
   (en GitHub, `gh issue list --label`).
3. **Por título**, como último recurso, y solo para proponer candidatos: una
   coincidencia por título **nunca se reutiliza sin confirmación**.

`tracker-links.json` es una caché; las etiquetas son el registro que permite
reconstruirla. Si el fichero se pierde, las etiquetas evitan duplicar la
jerarquía entera. También permiten **adoptar** trabajo que no nació en OpenSpec:
basta con etiquetarlo.

## Regla de colgado

**Ningún nivel se crea vacío y ningún elemento queda huérfano.** Si un nivel no
hace falta, el hijo se cuelga del **ancestro existente más cercano**:

| Caso | Epic | Feature | Story | Las Tasks cuelgan de |
|---|---|---|---|---|
| Capacidad nueva | nueva | nueva | nuevas | su Story |
| Capacidad ya registrada (lo habitual) | **existente** | nueva | nuevas | su Story |
| Ampliación de un trabajo en curso | existente | **existente** | nuevas | su Story |
| Ajuste de un requisito ya abierto | existente | existente | **existente** | la Story existente |
| Cambio técnico sin requisitos | existente | nueva o existente | ver nota | ver nota |

**Nota sobre las Tasks sin requisito.** En la mayoría de procesos, una Task solo
aparece en el tablero del sprint si su padre es del nivel de requisito (User
Story, Product Backlog Item; en GitHub, `tipo:story`). Colgada directamente de una Feature queda
fuera del tablero y nadie la ve. Por eso, sin requisito, cuélgala de una Story
existente relacionada o crea una **Story técnica** que la agrupe, y anótalo en
la sección `## Trazabilidad`: una tarea sin requisito suele ser trabajo que nadie
pidió.

Si `$TRACKER_HIERARCHY` tiene menos niveles (por ejemplo `Epic > Issue > Task`),
la regla se aplica igual sobre los niveles que existan.

**Un change que afecta a varias capacidades.** Una Feature solo tiene un padre.
Cuélgala de la Epic de la **primera capacidad** de la propuesta y enlaza las Epics
de las demás como relacionadas. Si el reparto no es evidente, pregunta.

## Operaciones por fase

### Al proponer un change

1. **Decide antes de crear.** La sección `## Trazabilidad` de `proposal.md`
   recoge, nivel a nivel, si se crea (`nuevo`) o se reutiliza (`existente #<id>`),
   con su motivo. Se rellena aplicando «Localizar lo existente» y la regla de
   colgado, y se revisa junto con la propuesta.
2. **Muestra el árbol y espera confirmación.** Antes de la primera escritura en
   `$TRACKER`, presenta qué se crea y qué se reutiliza, el sprint (y si hay que
   crearlo), y los Story Points, la prioridad y las horas de cada elemento.
   Deshacer elementos creados por error es caro; revisar una tabla es barato.
3. **Resuelve el sprint** como indica la sección «Sprint».
4. **Crea de arriba abajo**, solo lo marcado como `nuevo`, cada elemento con sus
   campos de `$TRACKER_FIELDS`:
   - Epic de la capacidad, si no existe.
   - Feature del change, con el enlace a `proposal.md` en la descripción.
   - Una Story por cada `### Requirement:` del spec delta, salvo las reutilizadas.
   - Las Tasks de `tasks.md`, bajo la Story que corresponda a su `ref:`.
5. **Etiqueta** todo lo creado: `openspec`, `cap:<capacidad>`, `change:<slug>`.
   Añade `change:<slug>` también a los elementos **reutilizados**, para que el
   vínculo sea recuperable.
6. Todo lo nuevo nace en el estado **al crear** de su tipo. Los reutilizados
   conservan su estado.
7. Escribe `tracker-links.json`, incluidos los identificadores reutilizados.

Si la revisión de un change cambia un `#### Scenario:`, la estimación o la
disciplina de una tarea, actualiza el campo correspondiente del elemento
existente.

Esta sección se ejecuta también desde `continue`, `explore` y `update` (revisión
de un change existente) cuando cambian `tasks.md` o los specs delta. Es
idempotente: crea lo que falta y no duplica lo que existe.

### Al implementar

**Al empezar una tarea:**

- Su Task pasa al estado **al empezar** y se registra su **fecha de inicio**.
- Si su sprint ya terminó, aplica el arrastre de la sección «Sprint».
- Si es la primera tarea de su Story, la Story también. Y lo mismo hacia arriba:
  la Feature al empezar su primera Story, la Epic al empezar su primera Feature.
  Solo si el elemento no había empezado ya: una Epic reutilizada suele estar
  activa desde hace tiempo.

**Al marcar `- [x]`:**

- Su Task pasa al estado **al terminar** y se registra su **fecha de fin**. Es
  la fecha real en que se acabó, no la del archivado.
- En la misma actualización, los campos que `$TRACKER_FIELDS` marca para
  escribir **al terminar** (por ejemplo, el trabajo completado y el pendiente a
  cero).
- La Story **no se cierra aquí**, aunque todas sus tareas estén hechas: lo hace
  el archivado, cuando el cambio ya está integrado. Una Story con el código sin
  revisar ni fusionar no está terminada.

**Al corregir un Bug** (su prueba de regresión pasa):

- Pasa al estado **al terminar** de su tipo y se registra su **fecha de fin**. Si
  no se había empezado, registra también la de inicio.

Agrupa los cambios en **una sola llamada por lote** siempre que el gestor lo
permita. Una llamada por tarea multiplica la latencia y agota cuotas.

### Al verificar

- Cada hallazgo bloqueante genera un **Bug** hijo de la Feature, en su estado
  **al crear** y con sus campos de `$TRACKER_FIELDS`, con el criterio incumplido
  y cómo reproducirlo.
- Si el hallazgo ya tiene Bug abierto en `tracker-links.json`, **añade un
  comentario**; no crees otro.

### Al archivar

El archivado se hace tras integrar el cambio. Es el momento en que el trabajo de
negocio se da por terminado.

1. **Comprueba primero las Tasks.** Si alguna sigue sin terminar, **para y
   pregunta** antes de cerrar nada: archivar con trabajo pendiente es
   precisamente lo que hay que detectar, no ocultar.
2. **Stories** del change al estado **al terminar**, con su fecha de fin. Las
   reutilizadas (`reused: true`) solo si no les quedan hijos abiertos ajenos a
   este change.
3. **Feature** al estado **al terminar**, con el mismo criterio para las
   reutilizadas.
4. **Epic**: consulta en el gestor si le quedan hijos abiertos, **de cualquier
   change**. Si no le queda ninguno, pasa al estado **al terminar** de su tipo.
   Si le quedan, no se toca. `tracker-links.json` no basta para decidirlo: solo
   conoce los changes que pasaron por OpenSpec.
5. Los Bugs ya se resolvieron al corregirse. Si alguno sigue abierto, **no lo
   cierres**: avísalo, porque el change no debería haberse archivado.

## Trazabilidad del código

**Commits.** Incluye la referencia al elemento en el mensaje, con la sintaxis que
declare `$COMMIT_CONVENTION`. En la mayoría de gestores basta `#<id>` para que el
enlace se cree solo, sin llamadas adicionales.

> ⚠️ Comprueba que la referencia **no colisiona con el versionado automático**.
> Algunas herramientas de versionado derivan el incremento de versión del mensaje
> del commit, y ciertas palabras clave alteran la versión publicada. Respeta
> `$COMMIT_CONVENTION`: está definida precisamente para evitar esa colisión.

**Ramas.** El nombre incluye el identificador del elemento de trabajo, según la
convención declarada en `docs/project.md`.

**Propuestas de integración.** Al abrirlas, vincula la Feature y las Stories
implicadas. Es lo que cierra la cadena requisito → tarea → código → revisión.
En un proyecto multirepo (skill `rama-espejo`), las propuestas de cada
repositorio enlazado se vinculan a la **misma** Story o Bug.

## Implementación con GitHub Issues y Projects

Aplica cuando `$TRACKER` es `github-issues`. Las reglas de arriba no cambian.

**Herramienta: la CLI `gh`**, autenticada en la cuenta del repositorio. Usa sus
subcomandos (`gh issue`, `gh label`, `gh project`) y, para lo que no tiene
subcomando (sub-issues), `gh api`. **Nunca `curl`** ni tokens escritos a mano.
Antes de la primera escritura de la sesión, comprueba `gh auth status`: los
Projects exigen el permiso `project` (si falta, pide al usuario que ejecute
`! gh auth refresh -s project`).

| Operación | Comando |
|---|---|
| Buscar por etiqueta | `gh issue list --label "cap:<capacidad>" --state all --json number,id,title,state,labels` |
| Leer un elemento | `gh issue view <n> --json number,id,title,state,body,labels,url` |
| Crear un elemento | `gh issue create --title "<título>" --body-file <fichero> --label "tipo:<tipo>,openspec,cap:<c>,change:<slug>"` |
| Crear etiquetas que falten | `gh label create "<nombre>" --force` |
| Colgar de un padre | `gh api -X POST repos/{owner}/{repo}/issues/<padre>/sub_issues -F sub_issue_id=<id>` (el **id** numérico del hijo, no su número) |
| Listar hijos de un elemento | `gh api repos/{owner}/{repo}/issues/<n>/sub_issues --paginate --jq '.[] \| {number, state}'` |
| Añadir o quitar etiquetas | `gh issue edit <n> --add-label "<l>"` · `--remove-label "<l>"` |
| Comentar | `gh issue comment <n> --body "<texto>"` |
| Cerrar / reabrir | `gh issue close <n> --reason completed` · `gh issue reopen <n>` |
| Añadir al Project | `gh project item-add <$TRACKER_PROJECT> --owner <$TRACKER_ORG> --url <url del issue> --format json` |
| Campos del Project y sus ids | `gh project field-list <$TRACKER_PROJECT> --owner <$TRACKER_ORG> --format json` |
| Escribir un campo | `gh project item-edit --id <item> --project-id <id del project> --field-id <campo> --number <n>` · `--date AAAA-MM-DD` · `--single-select-option-id <opción>` · `--iteration-id <iteración>` · `--clear` |

- **Todo elemento nuevo se añade al Project** en cuanto se crea: un issue fuera
  del Project no tiene estado, fechas ni sprint.
- **Crear y colgar van seguidos.** Crea el issue, cuélgalo de su padre con
  `sub_issues` y añádelo al Project antes de pasar al siguiente. Si algo falla
  en medio, registra en `pending` lo que falta: un issue suelto es un huérfano.
- El cuerpo de los textos largos se pasa con `--body-file` (Markdown), nunca
  interpolado en la línea de comandos.
- **Estado y fechas en el mismo paso**: al empezar, `Status` y `Start date`;
  al terminar, `Status`, `End date` y el cierre del issue. Si se reabre, se
  vacía `End date` con `--clear`.
- Los **ids** de campos, opciones de selección e iteraciones se obtienen de
  `gh project field-list` y se pueden guardar en `tracker-links.json` para no
  repetir la consulta. Los **nombres** de campo deben coincidir con
  `$TRACKER_LIFECYCLE` y `$TRACKER_FIELDS`; si no existen, para y pregunta.
- **Hijos abiertos de una Epic, de cualquier origen**: lista sus sub-issues y,
  recursivamente, los de sus Features. No basta con `tracker-links.json`.
- **Vincular con la Pull Request**: `Refs #<id>` en la descripción, una línea
  por Story o Feature. **Nunca palabras de cierre** (`Closes`, `Fixes`,
  `Resolves`): GitHub cerraría los issues al fusionar y se saltaría el cierre
  ordenado del archivado.
- Agrupa las escrituras de un mismo nivel en un único bloque de comandos; no
  intercales consultas innecesarias entre ellas.

## Si el gestor falla

El trabajo de código **no se detiene** porque el gestor no responda: bloquearlo
convierte una incidencia de infraestructura en una parada de desarrollo.

Pero tampoco se ignora. Registra la operación fallida en el array `pending` de
`tracker-links.json`, avísalo de forma **destacada** en la salida, y reintenta al
inicio de la siguiente invocación. Un fallo silencioso deja la trazabilidad rota
justo en el punto donde alguien la necesitará meses después.

El hook de fin de sesión acepta `pending` como estado válido **en local**: el
trabajo está registrado, aunque no sincronizado. Lo que no acepta es que falte el
registro. En CI, en cambio, `pending` con entradas **bloquea**: nada se integra
con la trazabilidad a medias.

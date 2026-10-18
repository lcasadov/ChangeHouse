---
description: "16 · Genera el AGENTS.md del proyecto destino a partir de docs/project.md, en la raíz del repositorio."
argument-hint: "[contexto opcional]"
---

# 16 · AGENTS.md del proyecto

Produces el `AGENTS.md` **del proyecto destino**, en la raíz del repositorio,
instanciando `.claude/harness/templates/AGENTS.template.md` con los
valores de `docs/project.md`.

## Principio

**Este fichero se carga en cada interacción.** Todo lo que sobre se paga en cada
petición, incluida la más trivial. Por eso no es un lugar donde acumular: cada
sección debe ganarse su sitio respondiendo una pregunta que un agente se hace
al empezar.

Si una información solo hace falta a veces, su sitio es una instruction (se
activa por ruta), un skill (se activa por relevancia) o un prompt (se invoca).

## Requisitos previos

| Requisito | Por qué |
|---|---|
| `docs/project.md` sin `⚠️ PENDIENTE` bloqueantes | Cada hueco se convierte en una variable sin resolver |
| `.claude/harness/templates/AGENTS.template.md` disponible | Es el esqueleto |

Si falta un valor necesario, **para y pregúntalo**. No inventes comandos ni
rutas: un comando erróneo en este fichero se ejecuta a ciegas muchas veces antes
de que alguien sospeche de él.

## Paso 1 — Resolver

Sustituye **todas** las `$VARIABLE` de la plantilla por su valor real. El
`AGENTS.md` resultante **no debe contener ni una sola `$VARIABLE`**: a
diferencia de los artefactos de `.claude/`, este fichero no se lee con el
contrato delante, se lee como enunciado literal.

Elimina el bloque de cabecera de la plantilla y las filas que no apliquen: si no
hay interfaz, fuera la fila del agente de frontend; si no hay base de datos,
fuera de la línea de stack.

## Paso 2 — Verificar los comandos

**Ejecuta cada comando de la tabla** antes de escribirlo. Un comando que no
funciona es peor que su ausencia: el agente lo intenta, falla, y gasta la
siguiente vuelta diagnosticando el fichero de configuración en vez del problema.

Si alguno no puede verificarse en este entorno, márcalo explícitamente en vez de
darlo por bueno.

## Paso 3 — Añadir lo que solo sabe este proyecto

La plantilla cubre lo común. Añade **solo** lo que sorprendería a alguien que
llega nuevo y no está en ningún otro documento:

- Un paso de preparación no evidente (semilla de datos, servicio que debe estar
  levantado, variable de entorno sin la cual nada arranca).
- Una trampa conocida: un directorio generado que no se toca, una prueba que
  falla si se ejecuta en paralelo, un módulo que exige análisis previo.
- Una convención que el código sigue pero que ninguna herramienta obliga.

Cada añadido en imperativo y con su motivo. «No edites `X`» sin explicar por qué
se desobedece en cuanto estorba.

## Paso 4 — Podar

Relee y **quita**:

- Lo que ya dice el `README.md` para personas.
- Lo que repite un documento enlazado. Deja el enlace, no el contenido: dos
  copias divergen, y nadie sabe cuál manda.
- Lo genérico que un agente ya sabe («escribe código legible»).

Objetivo orientativo: **por debajo de 150 líneas**. Si lo superas, algo debería
estar en una instruction o en un skill.

## Ubicación

En la **raíz** del repositorio. Nunca dentro de `openspec/`, `docs/`,
`.github/` ni `.claude/`.

> En Claude Code, `CLAUDE.md` es el fichero que se carga siempre. `AGENTS.md`
> lo leen otras herramientas; si se genera, `CLAUDE.md` debe seguir siendo la
> referencia para Claude y no duplicar su contenido.

Los `AGENTS.md` se resuelven por subárbol de directorios: el más cercano al
fichero que se está editando gana. Uno colocado en `openspec/` solo se aplicaría
al editar specs, y quedaría invisible justo cuando se escribe código — el
contrario exacto de lo que se busca.

En un monorepo sí tiene sentido uno por paquete, además del de la raíz: el de
cada paquete añade sus comandos propios y no repite lo común.

## Verificación

Antes de darlo por terminado:

- [ ] No queda ninguna `$VARIABLE` sin resolver.
- [ ] Cada comando de la tabla se ha ejecutado y funciona.
- [ ] No hay secciones que describan el catálogo en vez del proyecto.
- [ ] Las rutas enlazadas existen en el repositorio.
- [ ] Está en la raíz.
- [ ] Un agente que solo leyera este fichero sabría instalar, arrancar, probar y
      a quién acudir para coordinar.

## Mantenimiento

Se actualiza cuando cambia un comando, se añade una trampa o cambian las ramas.
**Un comando obsoleto aquí se propaga a todo el trabajo**, porque nadie duda del
fichero que lleva meses funcionando.

Revísalo al cerrar cada change que toque la construcción, las pruebas o el
despliegue.


---

Contexto adicional del usuario: $ARGUMENTS

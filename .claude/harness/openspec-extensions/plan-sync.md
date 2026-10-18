# Extensión · Regeneración de `PLAN.md`

Mantiene `$OPENSPEC_PATH/PLAN.md` sincronizado con el estado real de los changes.

## Principio: se regenera, no se mantiene

Todos los números de este documento —tareas completadas, porcentajes, contadores
globales— son **derivables** de los `tasks.md`. Basta contar `- [x]` frente a
`- [ ]`.

Por eso **nunca se actualizan de forma incremental**. Nada de «incrementar el
contador» ni «sumar al denominador»: cada invocación **recuenta desde cero y
reescribe**.

La diferencia es lo que hace el sistema fiable. Con aritmética incremental, un
solo fallo en una operación corrompe el valor para siempre, porque cada
actualización parte del anterior; y nadie lo detecta, porque no hay con qué
contrastar. Con regeneración, un fallo se corrige solo en la siguiente
invocación, y da igual quién llame, en qué orden, ni si alguien se saltó un paso.

## Las dos zonas del documento

`PLAN.md` contiene información de dos naturalezas distintas, y confundirlas
destruye datos:

| Zona | Contenido | Quién la escribe |
|---|---|---|
| **Derivada** | Estado, progreso, contadores, listas de changes | Esta extensión, por completo |
| **Curada** | Fase, prerrequisitos, prioridad, notas, próximos pasos | Las personas |

La zona derivada va **entre marcadores** y se reemplaza íntegra en cada
ejecución. Todo lo que esté fuera **no se toca jamás**.

```markdown
<!-- catalogo:generado:inicio -->
...contenido regenerado...
<!-- catalogo:generado:fin -->
```

Que la fase o los prerrequisitos de un change no sean derivables no es un defecto
del diseño: es información que solo existe en la cabeza de alguien. La extensión
la **lee** de la tabla curada para enriquecer la tabla generada, pero nunca la
inventa ni la sobrescribe.

## Procedimiento

### Paso 1 · Inventariar los changes

- Activos: cada directorio en `$OPENSPEC_PATH/changes/` excepto `archive/`.
- Archivados: cada directorio en `$OPENSPEC_PATH/changes/archive/`.

### Paso 2 · Contar sobre `tasks.md`

Para cada change, sobre su `tasks.md`:

- `completadas` = número de líneas que casan con `^\s*-\s*\[x\]` (sin distinguir
  mayúsculas)
- `pendientes` = número de líneas que casan con `^\s*-\s*\[ \]`
- `total` = completadas + pendientes

Si no existe `tasks.md`, el change cuenta como `0/0` y se marca **sin artefactos**.
No lo omitas del informe: un change sin tareas suele ser un olvido, y ocultarlo
lo perpetúa.

### Paso 3 · Derivar el estado

Deriva el estado, **no lo leas del documento anterior**:

| Condición | Estado |
|---|---|
| Está en `archive/` | `✅ ARCHIVADO` |
| `total > 0` y `completadas == total` | `🟢 COMPLETO — sin archivar` |
| `completadas > 0` | `🔄 EN PROGRESO` |
| `completadas == 0` y `total > 0` | `❌ SIN EMPEZAR` |
| `total == 0` | `⚠️ SIN TAREAS` |

El estado `🟢 COMPLETO — sin archivar` merece existir por sí solo: delata el
trabajo terminado que nadie cerró, que de otro modo se confunde con el que sigue
en curso.

### Paso 4 · Leer la zona curada

Recupera de la tabla curada, por change: fase, prerrequisitos y notas. Si un
change no tiene fila ahí, déjalo con los campos vacíos y **anótalo** en la salida
para que alguien los rellene.

### Paso 5 · Reescribir la zona derivada

Reemplaza **todo** el contenido entre los marcadores por:

1. **Resumen ejecutivo** — una fila por change activo:
   `| change | estado | % | completadas/total | fase |`. El nombre del change y
   el recuento `completadas/total` van **literales** en la fila: el hook de fin
   de sesión los compara con `tasks.md`.
2. **Progreso global** — suma de `completadas` y de `total` de **todos** los
   changes activos, con su porcentaje. Recalculado, nunca acumulado.
3. **Contadores** — cuántos changes hay en cada estado del paso 3.
4. **Changes archivados** — el **nombre del directorio** en `archive/` (con su
   prefijo de fecha, tal cual), tareas completadas de su total y fecha. El hook
   de fin de sesión busca ese nombre exacto.

Fuera de los marcadores no se modifica **ni una línea**.

### Paso 6 · Informar de lo anómalo

Al terminar, comunica de forma visible:

- Changes al 100 % sin archivar → hay que cerrarlos.
- Changes sin `tasks.md`.
- Changes sin fila en la zona curada.
- Changes sin actividad, si puede determinarse por la fecha de modificación.

Esta es la parte que aporta valor real. Un documento de estado que solo dice
porcentajes se lee una vez; uno que señala **qué está mal** se consulta.

## Si `PLAN.md` no existe

Créalo con las dos zonas, la curada vacía y la derivada completa. No falles ni lo
omitas: la ausencia del fichero es el estado inicial normal de un proyecto.

## Regla de invocación

Se ejecuta **al terminar** cualquier operación de OpenSpec que modifique ficheros
bajo `$OPENSPEC_PATH`, nunca antes: el objetivo es reflejar el estado ya
modificado. Lo indica el `context` de `openspec/config.yaml`, y el hook de fin de
sesión comprueba que se hizo.

Al ser una regeneración completa, invocarlo de más es inocuo. Lo único que hace
daño es **no** invocarlo.

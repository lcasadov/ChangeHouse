# Formato común de los entregables

Reglas que comparten todos los entregables Word del catálogo: documento funcional, documento
de arquitectura e informes de seguridad. Lo enlazan los prompts `entregable-*`; no se invoca
por sí solo.

## Una familia indistinguible en forma

Los entregables de un proyecto, puestos uno junto a otro, **solo deben diferenciarse por su
contenido**. Aplica sin desviarte:

| Aspecto | Regla común |
|---|---|
| Portada | Misma banda de imagen con el logotipo, misma disposición y mismos tamaños |
| Pie de página | Misma tabla de cinco columnas: logo · título · revisión · fecha · número de página |
| Preliminares | `Ficha del documento` · `Histórico de versiones` · `Revisión y aprobación` · `Índice`, sin numerar y en este orden |
| Títulos | Capítulos `N. Título`, apartados `N.M Título`, subapartados `N.M.P Título`, anexos `Anexo X — Nombre` |
| Estilos de título | Mismos tamaños y mismo color en los tres niveles |
| Tablas | Mismo estilo, mismos colores de encabezado y de filas alternas, mismo tamaño de letra |
| Figuras | Mismo ancho, mismo pie `Figura N. Descripción.` y mismo estilo de pie |
| Índice | Campo `TOC` real, nunca una lista escrita a mano |
| Identificadores | Prefijo estable por tipo: `RF-` requisitos, `L-` limitaciones, `R-` recomendaciones, `ADR-` decisiones |
| Página | Mismo tamaño y mismos márgenes |

Los **valores** —tipografía, colores, medidas— los fija el perfil de ChangeHouse en
`.claude/harness/profile/entregables/formato.md`, y la plantilla ya los lleva aplicados.
Si algún día cambia la identidad visual, cambian los valores, **pero no la lista de elementos
que hay que unificar**.

## La plantilla

Cada entregable tiene la suya en `.claude/harness/profile/entregables/`, con el nombre
que indica su prompt. Trae montado todo lo que no es contenido: portada, pie, preliminares,
estilos, el índice como campo `TOC` y **la estructura completa de capítulos del documento**.

Las plantillas las genera `.claude/harness/scripts/build-entregables.py` a partir de los
bloques `ficha`, `aprobacion` e `indice` de cada prompt. **Si falta una plantilla o no
corresponde al índice actual de su prompt, regenérala** con
`python .claude/harness/scripts/build-entregables.py`; no la edites a mano.

### Marcadores

La plantilla contiene dos tipos de marcador. Al entregar **no puede quedar ninguno**.

| Marcador | Qué es | Qué haces |
|---|---|---|
| `{{CLAVE}}` | Un dato del documento: `SISTEMA`, `DESCRIPCION`, `ORGANIZACION`, `ESTADO`, `CLASIFICACION`, `REVISION`, `FECHA`, `AUTOR` | Lo sustituyes **en todas sus apariciones**: portada, ficha, histórico y pies |
| `[[texto]]` | Una indicación en el punto donde va el contenido | La sustituyes por el contenido que pide. Si la indicación está en cursiva bajo un título, el párrafo entero se reemplaza |

- `{{SISTEMA}}` y `{{DESCRIPCION}}` salen de `$PROJECT_NAME` y `$PROJECT_DESCRIPTION` en
  `docs/project.md`. El resto, del cuestionario de la fase 0.
- **Los pies van dentro de una tabla**, no en párrafos: el texto se sustituye en sus celdas.
- Un título con `— [[nombre]]` lleva el nombre concreto del elemento: el perfil, el flujo, el
  módulo.
- Un apartado **repetible** lo indica su texto: duplícalo tantas veces como haga falta —título
  e indicación— y renumera los siguientes. Si no hay ningún elemento, deja el apartado con una
  frase que lo diga; no lo elimines.
- Conserva la numeración y el propósito de cada capítulo. Adaptar un nombre al dominio está
  bien; suprimir un capítulo, no: si no aplica, dilo en él.

### Cómo construir el documento

1. **Parte de una copia de la plantilla.** Nunca crees un documento vacío ni copies estilos a
   mano: los estilos, la portada y el pie ya están bien.
2. Sustituye los `{{CLAVE}}` recorriendo párrafos, **celdas de tabla** y **pies** de todas las
   secciones.
3. Escribe el contenido bajo cada título, en sustitución de su indicación `[[…]]`, con los
   estilos de la plantilla: `Normal`, `List Bullet`, `List Number`, `Caption` para los pies de
   figura y `Heading 1` a `Heading 3` para los títulos que añadas. **No crees estilos nuevos
   ni apliques formato directo** salvo en las tablas.
4. Genera las tablas con estilo `Table Grid` y el formato del perfil. Las tablas preliminares
   de la plantilla son la referencia exacta: replica su encabezado, sus filas alternas, su
   tamaño de letra y sus anchos.
5. Inserta las figuras a la anchura de texto que indique el perfil, cada una con su pie
   numerado.
6. Actualiza el índice con Word antes de entregar (ver la verificación).

Escribe el contenido con un guion propio (con `python-docx` o equivalente) que lea un
Markdown acotado y soporte encabezados, párrafos con negrita, cursiva y código, listas,
citas, tablas, figuras con pie y saltos de página. Conserva el guion: regenerar el documento
debe ser una orden, no una tarde de trabajo.

### Detalles que evitan retrabajo

- En las tablas, el sombreado se aplica con un elemento `w:shd` en el `tcPr` de **cada celda**
  (`w:val="clear"`, `w:color="auto"`, `w:fill` con el color). La anchura también se aplica
  celda a celda: fijarla en `table.columns` no basta.
- **Máximo cinco o seis columnas por tabla.** Con más, el ancho mínimo por columna parte las
  palabras. Agrupa los recuentos en una sola celda (`7 / 14 / 6 / 5`) o divide la tabla.
- El salto de página se aplica como `page_break_before` del bloque siguiente, **nunca** como
  párrafo propio: si no, aparecen páginas en blanco. Los capítulos de la plantilla ya lo llevan.
- Recorta los párrafos vacíos finales; si el documento acaba en tabla, cierra con un párrafo
  de 1 pt para que Word no añada una página.
- Soporta cursiva y código anidados dentro de negrita, o saldrán los asteriscos y las comillas
  invertidas literales.
- Si una tabla arranca al pie de página y queda partida, fuerza el salto antes del apartado.
- **En Windows, fija la codificación UTF-8** al leer o escribir texto y al capturar la salida
  de otros programas. Un «·» mal codificado aparece como «Â·» en la portada o en el pie.

## Verificación obligatoria antes de entregar

1. **No quedan marcadores.** Busca `{{` y `[[` en el texto de los párrafos, las tablas y los
   pies. Cualquier aparición es un documento sin terminar.
2. **Actualiza los campos y exporta a PDF con Word** por automatización
   (`ExportAsFixedFormat(ruta, 17)`). Si Word abre el documento en solo lectura, no fuerces:
   averigua la causa (fichero bloqueado, otra instancia de Word abierta).
3. Cuenta las páginas y **detecta las páginas en blanco**, ignorando la franja del pie.
4. **Renderiza las páginas a imagen y míralas.** Es la única forma de ver tablas partidas,
   palabras cortadas, saltos mal colocados y diagramas ilegibles.
5. Cierra los procesos de Word que queden abiertos.
6. Comprueba que ninguna cifra contradiga a otra y que las referencias cruzadas existan tras
   cualquier renumeración.
7. Advierte al usuario de que actualice los campos si abre el documento y el índice no
   coincide.

## Higiene de trabajo

- Crea una rama antes de tocar nada y verifica con `git branch --show-current` antes de cada
  commit.
- Los entregables van a `docs/entregables/`, y sus evidencias, si las hay, a
  `docs/entregables/evidencias/<fecha>/`.
- Un `.docx` **no es determinista a nivel de bytes**: regenerarlo cambia el fichero aunque el
  contenido sea idéntico. Nunca hagas `git add` de un directorio; añade ficheros concretos y,
  si el guion genera varios documentos, dale una opción para regenerar solo uno.
- No modifiques la plantilla para acomodar un documento. Si le falta algo, cambia el índice
  del prompt o el generador y **regenera las cuatro**: la familia debe seguir siendo
  indistinguible en forma.

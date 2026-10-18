# Perfil de ChangeHouse — formato de los entregables

Valores que aplican las plantillas de esta carpeta. Las reglas —qué elementos se unifican y
cómo se construye el documento— están en `.claude/harness/entregables-formato.md`; aquí solo
los valores.

## Plantillas

| Plantilla | Prompt |
|---|---|
| `documento-funcional.docx` | `entregable-documento-funcional` |
| `documento-arquitectura.docx` | `entregable-documento-arquitectura` |
| `informe-seguridad-primera-emision.docx` | `entregable-informe-seguridad-primera-emision` |
| `informe-seguridad-reemision.docx` | `entregable-informe-seguridad-reemision` |

Las genera `.claude/harness/scripts/build-entregables.py` a partir de los bloques `ficha`,
`aprobacion` e `indice` de cada prompt, y dibuja también las imágenes de `assets/`. **No se
editan a mano**: si cambia la estructura de un entregable, se cambia su prompt y se regeneran.

```bash
python .claude/harness/scripts/build-entregables.py                  # las cuatro
python .claude/harness/scripts/build-entregables.py --only funcional # solo una
```

Requiere Python 3.10+ con `python-docx` y `Pillow`.

## Identidad

| Elemento | Valor |
|---|---|
| Marca | **ChangeHouse** — casa blanca dentro de un ciclo de dos flechas (cambio de casa y cadenas de intercambio), sobre cuadrado coral redondeado |
| Color principal | Coral `E8505B` |
| Color secundario | Azul marino `1F2A44` |
| Tinte claro | `FDEEEF` (filas alternas) |
| Texto | Gris oscuro `3A3A3A` · secundario `5A6672` |

## Tipografía

| Elemento | Valor |
|---|---|
| Cuerpo de texto (`Normal`) | Calibri 10,5 pt, gris `3A3A3A`, interlineado 1,15, 6 pt después |
| Título 1 | 18 pt, negrita, azul marino `1F2A44`, salto de página antes, filete coral inferior |
| Título 2 | 14 pt, negrita, coral `E8505B` |
| Título 3 | 12 pt, negrita, azul marino `1F2A44` |
| Pie de figura (`Caption`) | 9 pt, cursiva, gris `5A6672`, centrado, sin negrita |
| Pie de página | 8 pt, gris `5A6672`, en una tabla de una fila y cinco columnas |
| Portada | Banda de imagen a todo el ancho con el logotipo; sistema en 30 pt azul marino, descripción en 16 pt gris y tipo de documento en 15 pt coral, todo en negrita salvo la descripción |
| Indicaciones `[[…]]` | Cursiva, gris `5A6672`. Desaparecen al redactar |

## Tablas

| Elemento | Valor |
|---|---|
| Estilo base | `Table Grid`, bordes `D9DDE3` de 0,5 pt |
| Relleno del encabezado | Azul marino `1F2A44`, texto blanco `FFFFFF` en negrita |
| Filas de datos | Alternas: sin relleno y `FDEEEF` |
| Texto de las celdas | Gris `3A3A3A`, 9 pt · 8 pt para fragmentos en `Consolas` |
| Anchura total | 16 cm · mínimo 2,1 cm por columna |
| Ajuste automático | Desactivado |

## Página y figuras

| Elemento | Valor |
|---|---|
| Tamaño | **A4**, 11906 × 16838 twips |
| Márgenes del cuerpo | 2,5 cm izquierda y derecha · 2,5 cm arriba · 2,2 cm abajo |
| Figuras | 16 cm de ancho y 20 cm de alto como máximo |

## Clasificación

No hay etiqueta de confidencialidad aplicada por herramienta. La clasificación se declara en
el campo `Clasificación` de la ficha y en la portada: `Público`, `Uso interno` o
`Confidencial`. Los informes de seguridad son siempre `Confidencial`.

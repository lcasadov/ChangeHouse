---
description: "10 · Genera $STYLE_GUIDE_DOC: tokens de diseño, temas, componentes, accesibilidad y comportamiento responsivo de la interfaz."
argument-hint: "[contexto opcional]"
---

# 10 · Guía de estilo de la interfaz

Eres un **diseñador de sistemas de interfaz senior**. Produces
`$STYLE_GUIDE_DOC`, referenciado **18 veces** por el catálogo.

> Si el proyecto no tiene interfaz de usuario, no ejecutes este prompt: indícalo
> y marca `$STYLE_GUIDE_DOC` como `N/A` en `docs/project.md`.

## Entradas

`docs/project.md` (`$UI_LIBRARY`, `$THEMES`, `$A11Y_LEVEL`, `$BROWSER_MATRIX`,
`$I18N`), las hojas de estilo y los componentes existentes.

## Índice a generar

### 1 · Fundamentos de diseño
Los **tokens**: color, tipografía, espaciado, radios, sombras y elevación.

Cada token con su nombre técnico exacto tal como se usa en el código, su
propósito y su valor por tema. La regla que gobierna esta sección:

> **Ningún componente usa un valor de color, espaciado o tipografía en crudo.**
> Siempre a través de un token. Un valor en crudo funciona en el tema en que se
> escribió y rompe en todos los demás.

### 2 · Temas
Los temas de `$THEMES`, cuál es el predeterminado, cómo se conmuta y cómo se
persiste la elección. Todo componente debe ser correcto en **todos** ellos.

### 3 · Catálogo de componentes
Por componente: cuándo usarlo, cuándo **no**, sus variantes y sus estados —
reposo, foco, activo, deshabilitado, cargando, error y **vacío**.

Los estados de carga, error y vacío son los que más se olvidan y los que más
degradan la percepción del producto.

### 4 · Composición y disposición
Rejilla, puntos de corte responsivos, anchos máximos y densidad. Qué ocurre con
tablas y formularios largos en pantallas estrechas: es donde antes se rompe una
interfaz.

### 5 · Retroalimentación al usuario
Cuándo se usa cada mecanismo: notificación efímera, mensaje en línea, diálogo de
confirmación, indicador de progreso.

- Toda acción destructiva se confirma, y la confirmación **nombra** lo que se va
  a destruir.
- Toda operación que supere el umbral perceptible muestra progreso.
- Todo error muestra **qué hacer a continuación**, no solo qué ha fallado.

### 6 · Formularios
Momento de la validación, presentación del error junto al campo, campos
obligatorios, valores por defecto y prevención de doble envío.

### 7 · Accesibilidad
Requisitos de `$A11Y_LEVEL`, como mínimo verificables:

- Contraste suficiente en **todos** los temas, no solo en el predeterminado.
- Toda la funcionalidad alcanzable con teclado, con foco siempre visible.
- Etiquetas asociadas a sus controles y textos alternativos con significado.
- Los cambios dinámicos se anuncian a los lectores de pantalla.
- El color **nunca** es el único portador de información.

### 8 · Idioma y contenido
Tratamiento, tono, mayúsculas, formato de fechas, números y moneda. Si `$I18N`
está activo, la regla es absoluta: **ningún texto visible se escribe en el
código**.

## Reglas

- Extrae los nombres de token **reales** del proyecto. Una guía con nombres
  inventados no es aplicable.
- Si detectas valores en crudo en el código existente, recógelos en una sección
  de **deuda de estilo** con su ubicación.
- Cada regla debe poder verificarse mirando un componente concreto.

## Salida

```
$STYLE_GUIDE_DOC
```


---

Contexto adicional del usuario: $ARGUMENTS

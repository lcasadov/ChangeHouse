---
description: "Use when creating or modifying any client-side source file. Enforces cross-cutting UX, accessibility, feedback and responsive behavior standards. Stack-agnostic."
paths:
  - "frontend/src/**"
  - "web/src/**"
  - "client/src/**"
  - "ui/src/**"
  - "apps/*/src/**"
---

# Convenciones transversales de UX y accesibilidad

> Reglas genéricas. Las convenciones concretas de producto —iconografía,
> patrones de interacción, catálogo de tokens, idiomas y rutas de recursos—
> viven en `$STYLE_GUIDE_DOC`. Ajusta los `paths` del frontmatter de este fichero a la
> estructura real del proyecto durante el arranque.

## Realimentación y estado

- Toda acción del usuario produce una realimentación observable: éxito, error o
  progreso.
- Las operaciones destructivas exigen confirmación explícita antes de ejecutarse.
- Los estados de carga preservan el diseño: prefiere marcadores de posición que
  reserven el espacio final frente a contenedores vacíos o saltos de maquetación.
- Cubre siempre los tres estados de una vista de datos: cargando, vacío y con
  error. El estado vacío explica qué falta y ofrece la acción siguiente.
- Los mensajes de error son accionables: dicen qué ha fallado y qué puede hacer
  la persona usuaria. Nunca expongas trazas ni detalles internos.

## Interacción

- Los patrones de interacción son consistentes en toda la aplicación: la misma
  acción se representa y se dispara siempre igual.
- Los patrones concretos del producto están definidos en `$STYLE_GUIDE_DOC`; no
  inventes variantes.
- Los controles que disparan una operación asíncrona se deshabilitan mientras
  está en curso para evitar envíos duplicados.
- Tras cerrar un diálogo o completar una acción, el foco vuelve a un punto
  predecible.

## Accesibilidad

- Nivel objetivo: `$A11Y_LEVEL`.
- Estructura semántica correcta: encabezados jerarquizados, listas, tablas y
  regiones con su rol adecuado.
- Todo control interactivo es alcanzable y operable **solo con teclado**, con
  indicador de foco visible.
- Toda entrada de formulario tiene una etiqueta asociada de forma programática.
- Los cambios de estado relevantes se anuncian a los productos de apoyo.
- El contraste de color cumple el nivel exigido en **todos** los temas
  declarados en `$THEMES`.
- El color nunca es el único portador de significado.

## Tematización

- Usa exclusivamente los tokens de diseño de `$STYLE_GUIDE_DOC`. **Prohibido**
  cualquier valor literal de color, sombra, radio o espaciado.
- Verifica el resultado en todos los temas de `$THEMES` antes de dar por
  terminado el cambio.

## Internacionalización

- **Ningún texto visible se escribe literalmente en el código.** Todo pasa por el
  sistema de `$I18N`.
- Al añadir una clave, añádela en **todos** los idiomas soportados. Un idioma sin
  la clave es un fallo, no una degradación aceptable.
- Añade o mantén un test que verifique la paridad de claves entre idiomas.
- Formatea fechas, números y monedas mediante el sistema de internacionalización,
  nunca a mano.

## Comportamiento adaptable

- Las vistas funcionan en toda la matriz de dispositivos y navegadores declarada
  en `$BROWSER_MATRIX`.
- Ningún contenido queda inaccesible por desbordamiento: las tablas y contenedores
  anchos degradan de forma controlada.
- Los objetivos táctiles tienen tamaño suficiente para uso con el dedo.

## Tests

- Todo cambio con comportamiento observable requiere test.
- Prueba el comportamiento observable, no los detalles de implementación.
- Cubre al menos un camino de accesibilidad relevante por vista: navegación por
  teclado o asociación de etiquetas.
- Cobertura `>= $COVERAGE_THRESHOLD` según `docs/TESTING-STRATEGY.md`
  (fuente autoritativa).

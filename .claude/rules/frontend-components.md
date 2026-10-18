---
description: "Use when creating or modifying UI components, pages or views. Enforces naming, file structure, theming, accessibility and test coverage. Stack-agnostic."
paths:
  - "apps/mobile/app/**"
  - "apps/mobile/src/**/{components,screens}/**"
  - "apps/landing/src/{components,pages,layouts}/**"
  - "packages/ui/src/**"
---

# Convenciones de componentes de interfaz

> Reglas genéricas. Todo lo específico del proyecto vive en `docs/project.md`
> y en `$STYLE_GUIDE_DOC`. Ajusta los `paths` del frontmatter de este fichero a la estructura
> real del proyecto durante el arranque.

## Nomenclatura

- El nombre del fichero sigue la convención idiomática de `$UI_FRAMEWORK` para
  componentes y se mantiene consistente en todo el proyecto.
- El nombre del componente exportado coincide con el del fichero.
- Los ficheros auxiliares dentro de una carpeta de componente pueden usar otra
  convención, siempre que sea consistente.
- Respeta la convención de carpetas existente. No renombres carpetas salvo
  petición explícita.

## Estructura del fichero

- Un componente principal por fichero.
- Orden recomendado: importaciones, constantes y auxiliares locales, definición
  del componente, tipos de propiedades, exportación.
- La lógica de presentación vive en el componente; la lógica reutilizable no
  visual se extrae a hooks/composables o a casos de uso.
- **Ninguna llamada al backend desde un componente.** Usa los adaptadores de
  salida de la capa de infraestructura.
- Los componentes son adaptadores de entrada de la interfaz.
- No incrustes mapeo de transporte, suposiciones de persistencia ni orquestación
  de flujos entre pantallas dentro de un componente.

## Experiencia de usuario y accesibilidad

- Prefiere entradas controladas en los formularios.
- La realimentación de validación se muestra junto al campo afectado.
- Estructura semántica y etiquetas asociadas a cada control de formulario.
- Los mensajes de error son accionables y están ligados al campo o acción exacta.
- Aplica las reglas transversales de UX y accesibilidad del proyecto.
- Para estados de carga a nivel de componente, prefiere marcadores de posición
  que preserven el diseño frente a contenedores vacíos.

## Tematización (obligatorio)

- Todo componente debe funcionar correctamente en **todos** los temas declarados
  en `$THEMES`.
- Usa **siempre** los tokens de diseño definidos en `$STYLE_GUIDE_DOC`.
  **Prohibido** cualquier valor de color, sombra, radio o espaciado literal.
- Esto aplica igualmente a los estilos en línea y a las propiedades de estilo de
  la librería de componentes: se referencia el token, nunca el valor.
- Las superficies de diálogo y modal delegan su fondo y su borde en los tokens
  correspondientes, no los declaran a mano.
- Si falta un token, **propón añadirlo a `$STYLE_GUIDE_DOC`**; no lo esquives con
  un valor literal.

## Tests y cobertura

- Añade o actualiza tests en cada cambio significativo de un componente.
- Cubre renderizado, interacciones de usuario y estados de validación y error.
- Al menos un caso negativo o límite por componente modificado.
- Al menos un comportamiento de UX cuando sea relevante: gestión del foco, estado
  deshabilitado, camino de reintento, estado vacío.
- Si el componente carga contenido de forma asíncrona, verifica el marcador de
  posición y la transición al contenido final.
- Cobertura `>= $COVERAGE_THRESHOLD` según `docs/TESTING-STRATEGY.md`
  (fuente autoritativa).

## Salvaguardas

- No inventes campos, enumerados ni contratos de endpoint del backend.
- Si el contrato de la API no está claro, **para y pide clarificación**.
- No dejes que la forma del objeto de transferencia del backend dicte la interfaz
  del componente: introduce un modelo de vista o un mapeador cuando aporte
  estabilidad.
- **Todo texto visible para el usuario pasa por el sistema de `$I18N`.** Nunca
  escribas literales de idioma en el marcado. Añade las claves nuevas en todos
  los idiomas soportados antes de usarlas.

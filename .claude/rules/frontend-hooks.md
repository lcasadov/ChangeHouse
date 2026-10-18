---
description: "Use when creating or modifying reusable UI logic units (hooks, composables). Enforces naming, structure, side-effect discipline, error/loading state exposure and test coverage. Stack-agnostic."
paths:
  - "frontend/**/{hooks,composables}/**"
  - "web/**/{hooks,composables}/**"
  - "client/**/{hooks,composables}/**"
  - "**/src/**/{hooks,composables}/**"
---

# Convenciones de lógica de interfaz reutilizable

> Reglas genéricas. Todo lo específico del proyecto vive en `docs/project.md`.
> Ajusta los `paths` del frontmatter de este fichero a la estructura real del proyecto durante
> el arranque.

Se aplica a las unidades de lógica reutilizable de la capa de interfaz —hooks,
composables o el equivalente en `$UI_FRAMEWORK`.

## Nomenclatura

- El nombre del fichero sigue la convención de `$UI_FRAMEWORK` para este tipo de
  unidad y es consistente en todo el proyecto.
- El nombre de la función exportada coincide con el del fichero.
- Las funciones auxiliares internas usan nombres basados en verbos claros.

## Estructura

- Una unidad principal por fichero.
- Orden recomendado: importaciones, constantes y auxiliares, implementación,
  interfaz exportada.
- Devuelve una interfaz **estable y explícita**: valores de estado, valores
  derivados y acciones.
- Ninguna preocupación de renderizado: estas unidades gestionan estado, efectos
  y comportamiento, no interfaz.
- Son adaptadores de entrada que coordinan la intención del usuario con los casos
  de uso de la aplicación.
- Pueden orquestar intención, transiciones de estado y llamadas a casos de uso,
  pero **nunca** se convierten en adaptadores de transporte de bajo nivel.

## Efectos y flujo de datos

- Mantén los efectos secundarios dentro de las primitivas de efecto del
  `$UI_FRAMEWORK`.
- Declara dependencias **completas y explícitas**; sin dependencias ocultas.
- Cancela o descarta las peticiones asíncronas obsoletas para evitar condiciones
  de carrera y actualizaciones de estado tras el desmontaje.
- Evita la manipulación directa del árbol de documento salvo necesidad estricta,
  y documéntala.
- Todo acceso a la red pasa por los adaptadores de salida. **Nunca** un cliente
  HTTP en bruto dentro de esta capa.

## Manejo de errores y estado

- Expón estados de error y de carga predecibles para quien los consuma.
- Normaliza la salida de error para que la interfaz pueda mostrar realimentación
  accionable.
- No navegues ni muestres avisos desde aquí, salvo que el propósito de la unidad
  sea explícitamente la navegación.
- Expón indicadores de estado explícitos que soporten el renderizado: cargando,
  vacío, con error.
- Mantén la salida estable para evitar parpadeos y regresiones de interacción.
- Sigue las reglas transversales de UX y accesibilidad cuando la unidad gobierne
  comportamiento visible.

## Tests y cobertura

- Añade o actualiza tests en cada unidad nueva o modificada.
- Valida: estado inicial, transiciones de estado, camino asíncrono correcto,
  camino asíncrono con error y comportamiento de limpieza.
- Al menos un caso límite: entrada vacía, cancelación, respuesta obsoleta o
  disparo repetido.
- Tests deterministas, con dobles de prueba y control del tiempo cuando proceda.
- Si la unidad gobierna navegación o transiciones de autenticación, verifica el
  comportamiento de repliegue y las condiciones de redirección.
- Cobertura `>= $COVERAGE_THRESHOLD` según `docs/TESTING-STRATEGY.md`
  (fuente autoritativa).

## Salvaguardas

- No inventes endpoints ni campos de petición o respuesta.
- Si falta detalle del contrato del backend, **para y pide clarificación**.
- No modifiques código de servidor desde tareas de esta capa.
- No te saltes los adaptadores de salida incrustando clientes de red aquí.

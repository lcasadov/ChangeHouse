---
description: "06 · Genera el contrato de API en $API_CONTRACT: recursos, esquemas, códigos de estado, errores y seguridad. Fuente de verdad entre cliente y servidor."
argument-hint: "[contexto opcional]"
---

# 06 · Contrato de API

Eres un **arquitecto de API senior**. Produces `$API_CONTRACT`, el fichero que
tanto el agente de cliente como el de servidor tratan como **ley**: la regla 4
del catálogo prohíbe inventar cualquier endpoint o campo que no esté aquí.

## Entradas

`docs/project.md`, `docs/architecture.md`, `docs/datamodel.md`, y los
controladores y clientes HTTP **ya existentes en el código**.

Si ya hay contrato, este prompt lo **extiende y corrige**; no lo reescribe desde
cero.

## Qué generar

Especificación **OpenAPI 3.1** (o la versión que declare `docs/project.md`) en
YAML, completa y válida.

### Por cada operación

| Elemento | Exigencia |
|---|---|
| Ruta y método | Coherentes con el resto: o todo plural, o todo singular |
| Parámetros | Tipo, obligatoriedad y formato. Los de paginación y ordenación, unificados en toda la API |
| Cuerpo de petición | Esquema con tipos, formatos, obligatoriedad y **restricciones de validación** |
| Respuestas | Un esquema por cada código que la operación puede devolver |
| Códigos de estado | El conjunto real, no solo el camino feliz |
| Seguridad | Esquema aplicado y **roles autorizados**, alineados con `$RBAC_MATRIX_DOC` |

### Códigos de estado

No basta con `200`. Documenta explícitamente cuándo se devuelve `400`, `401`,
`403`, `404`, `409` y `422`. La diferencia entre `401` y `403`, y entre `404` y
`403`, es una **decisión de seguridad**: revelar que un recurso existe a quien no
puede verlo es una fuga de información. Decídela y déjala escrita.

### Errores

Un **único** formato de error para toda la API, con esquema propio y
reutilizado. Debe incluir identificador de correlación para el diagnóstico y
**nunca** trazas internas, consultas ni nombres de tabla.

### Componentes reutilizables

Esquemas, respuestas y parámetros compartidos en `components`. Un esquema
duplicado es un contrato que divergirá.

## Reglas

- **No inventes endpoints.** Si el producto necesita una operación que nadie ha
  especificado, propónla aparte y espera confirmación.
- No expongas la estructura interna de persistencia. El contrato es lo que la
  API promete, no lo que la base de datos guarda.
- Marca lo que se retira como `deprecated` con fecha; no lo borres sin acuerdo.
- Los ejemplos deben ser **válidos contra su propio esquema**.
- Valida la sintaxis del fichero antes de darlo por terminado.

## Salida

```
$API_CONTRACT
```

Informa al terminar de: operaciones añadidas, modificadas y marcadas obsoletas,
más las discrepancias detectadas entre el contrato y el código actual.


---

Contexto adicional del usuario: $ARGUMENTS

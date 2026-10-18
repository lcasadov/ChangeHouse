---
description: "12 · Genera el árbol de trabajo Epic → Feature → Historia → Tarea con criterios INVEST y priorización. Los criterios de aceptación viven en los specs, no aquí."
argument-hint: "[contexto opcional]"
---

# 12 · Backlog inicial

Eres un **Product Owner senior** experto en descomposición de trabajo. Produces
`docs/backlog.md`, el puente entre el producto y los elementos de `$TRACKER`.

## Frontera con OpenSpec — léela antes de nada

| Documento | Responde | Formato |
|---|---|---|
| `docs/backlog.md` | **Qué construir y en qué orden** | Historias INVEST, prioridad, dependencias |
| `$OPENSPEC_PATH/.../spec.md` | **Cómo sabremos que está bien** | `Requirement:` SHALL + `Scenario:` Given/When/Then |

> **No escribas criterios de aceptación en Given/When/Then en este documento.**

El motivo no es de estilo. Dos fuentes de criterios de aceptación divergen
siempre —una se corrige y la otra no— y cuando divergen nadie sabe cuál manda.
El spec es el que las pruebas verifican y el que lee el agente de
implementación: por tanto es el único que puede ser autoritativo.

El backlog **identifica y prioriza**. El spec **especifica**.

En `$TRACKER` los criterios sí aparecen, pero como **copia**: al crear la Story,
`.claude/harness/openspec-extensions/tracker-sync.md` los toma de los escenarios del
spec y los regenera cuando cambian. El spec sigue mandando.

## Entradas

`docs/product.md`, `docs/project.md`, `$API_CONTRACT`, `$RBAC_MATRIX_DOC` y los
specs consolidados de `$OPENSPEC_PATH/specs/`, que te dicen **qué existe ya**.

**Solo eso.** Este prompt descompone lo decidido; no inventa funcionalidad.

## Jerarquía

```
Epic → Feature → Historia de usuario → Tarea | Defecto
```

Respeta la jerarquía y los nombres que declare `docs/project.md` para
`$TRACKER`. Si el proyecto usa otra, adáptate a ella.

## Criterios de calidad de una historia

Verifica **INVEST** antes de darla por buena:

| Criterio | Pregunta que debes responder |
|---|---|
| Independiente | ¿Puede entregarse sin esperar a otra? Si no, declara la dependencia |
| Negociable | ¿Describe el **qué**, dejando el **cómo** al equipo? |
| Valiosa | ¿Un usuario nota la diferencia? Si solo la nota el equipo, es una tarea |
| Estimable | ¿Hay información suficiente para dimensionarla? |
| Pequeña | ¿Cabe holgadamente en una iteración? Si no, divide por regla de negocio, **nunca por capa técnica** |
| Verificable | ¿Puede escribirse un spec con escenarios comprobables? |

Una historia que no supera INVEST no entra: divídela o marca qué le falta.

## Relación con las capacidades

Cada historia se asocia a una **capacidad** de `$OPENSPEC_PATH/specs/`. Indica
si esa capacidad ya existe —y la historia la amplía— o si es nueva.

Si una historia no encaja en ninguna capacidad conocida ni justifica una nueva,
es señal de que está mal delimitada.

## Priorización

Propón un orden y **justifícalo**, según:

1. Riesgo técnico o de negocio: lo que puede invalidar el enfoque va primero.
2. Dependencias: lo que desbloquea a otros.
3. Valor entregado por esfuerzo.
4. Lo que permite validar el concepto extremo a extremo antes que cualquier
   funcionalidad accesoria.

## Formato de salida

```markdown
### [Épica > Funcionalidad] Título en forma de resultado

**Como** <perfil> **quiero** <capacidad> **para** <beneficio>

**Capacidad**: <nombre en los specs consolidados> — <existente | nueva>
**Alcance**: <en una frase, qué entra y qué queda fuera>
**Dependencias**: <historia o "ninguna">
**Prioridad**: <alta | media | baja> — <motivo en una línea>
**Riesgos o dudas**: <lo que habrá que resolver al especificar>
```

Incluye al final un diagrama Mermaid del árbol, y otro de dependencias si las
hay.

## Reglas

- **No inventes funcionalidad** que no esté en `docs/product.md`. Si detectas un
  hueco evidente, señálalo como pregunta abierta.
- **No escribas Given/When/Then.** Eso se redacta al abrir el change, en el
  delta de su spec.
- No dividas por capa: «el backend de X» no es entregable por sí solo.
- No estimes en horas: no tienes información para hacerlo.
- Este prompt **no crea elementos en `$TRACKER` ni changes en `$OPENSPEC_PATH`.**
  Los elementos de trabajo los crea el orquestador, único agente autorizado; los
  changes, el ciclo de propuesta de OpenSpec.

## Salida

```
docs/backlog.md
```


---

Contexto adicional del usuario: $ARGUMENTS

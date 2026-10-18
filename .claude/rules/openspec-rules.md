---
description: "Use when creating or modifying OpenSpec artifacts (proposals, designs, task checklists, capability specs). Enforces the delta/consolidated spec model, BDD scenarios and TDD task ordering. Stack-agnostic."
paths:
  - "openspec/**"
---

# Reglas de OpenSpec

OpenSpec es la fuente única de verdad para requisitos y decisiones de diseño. El código implementa lo que OpenSpec especifica.

> Reglas genéricas, válidas para cualquier proyecto. Lo específico (capas del
> proyecto, gestor de trabajo, prefijo de identificadores) se lee de
> `docs/project.md`.

## Dos ubicaciones de specs (convención OpenSpec)

OpenSpec usa **dos** carpetas de specs que coexisten — no es una u otra:

1. **Delta del change** (temporal) — vive dentro del change:

   ```
   openspec/changes/<slug>/specs/<capability>/spec.md
   ```

   Describe SOLO lo que ese change cambia, con headers de delta:
   `## ADDED Requirements` / `## MODIFIED Requirements` / `## REMOVED Requirements` / `## RENAMED Requirements`.

2. **Spec consolidado** (permanente) — vive fuera del change:
   ```
   openspec/specs/<capability>/spec.md
   ```
   Estado actual acumulado de la capacidad. Se actualiza al archivar el change.
   Índice en `openspec/specs/README.md` · visión global en `openspec/specs/project.md`.

## Estructura obligatoria de un change

```
openspec/changes/<slug>/
├── proposal.md     ← Por qué / Qué cambia / Impacto / Fuera de alcance
├── design.md       ← Contexto / Decisiones / Riesgos / Plan de migración
├── tasks.md        ← Checklist [ ] / [x] agrupado por capa del proyecto
└── specs/
    └── <capability>/spec.md   ← DELTA: ADDED/MODIFIED/REMOVED + Escenarios BDD
```

## Al crear o modificar un change

- `proposal.md`: máximo 400 palabras. Secciones obligatorias: `## Why`, `## What Changes`, `## Capabilities`, `## Impact`, `## Out of scope`.
- `design.md`: incluir siempre `## Open Questions` para ambigüedades no resueltas.
- `specs/<capability>/spec.md`: delta con `### Requirement: <nombre>` (SHALL/MUST) + `#### Scenario:` GIVEN/WHEN/THEN, bajo el header de delta correspondiente.
- `tasks.md`: agrupar por las capas reales del proyecto (por ejemplo `## Backend` / `## Frontend` / `## Testing` / `## DevOps`). Marcar `[x]` solo cuando el agente responsable confirma la tarea completada.

## TDD obligatorio en tasks.md (Red → Green → Refactor)

- Por cada capa, las tareas de **test van ANTES** que las de implementación.
  Patrón recomendado por feature:
  1. `[ ]` (test) Escribir prueba del escenario `#### Scenario: <X>` — debe fallar sin código (Red)
  2. `[ ]` (impl) Implementar el mínimo código para pasar la prueba (Green)
  3. `[ ]` (refactor) Refactor manteniendo verde
- Cada `#### Scenario:` del spec debe tener al menos una tarea de test que lo cubra.
- Una tarea de test se marca `[x]` solo cuando: (a) la prueba existe, (b) falló sin código y (c) pasa con el código.
- Las pruebas son **inmutables** durante la implementación: para pasar se ajusta el código, nunca la prueba. Modificar una prueba exige cambiar antes el `#### Scenario:` del spec.

## Sincronización con el código y los specs consolidados

- Cada tarea completada en el código → marcar `[x]` en `tasks.md`.
- Si la implementación introduce un requisito no previsto → actualizar el delta `specs/` del change antes de commitear.
- Al archivar el change → volcar el delta al spec consolidado en `openspec/specs/<capability>/spec.md` y actualizar `openspec/specs/README.md`.
- El identificador del elemento de trabajo de `$TRACKER` (con prefijo `$TICKET_PREFIX`) debe aparecer en el nombre de rama y en `tasks.md`.

## Prohibido

- Marcar `[x]` una tarea sin que el agente responsable haya confirmado la implementación y los tests.
- Añadir requisitos en `proposal.md` que no tengan escenario BDD en `specs/`.
- Eliminar tareas de `tasks.md` para "limpiar" — usar tachado o nota si se desestiman.
- Implementar código de comportamiento sin una prueba previa que lo cubra (viola TDD).
- Debilitar, comentar, `skip`/`xit`/`@Disabled` o relajar una prueba para forzar el verde.

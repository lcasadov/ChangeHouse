---
description: "02 · Audita docs/project.md, prioriza lo pendiente por impacto y cierra las lagunas entrevistando al usuario una pregunta cada vez."
argument-hint: "[contexto opcional]"
---

# 02 · Auditoría del contrato del proyecto

Eres un **analista de sistemas senior**. Tu trabajo no es rellenar huecos por tu
cuenta: es **conseguir que el usuario los cierre**, uno a uno, empezando por los
que más daño hacen.

## Entradas

- `docs/project.md` — el contrato a auditar
- `.claude/harness/templates/project.template.md` — referencia de claves obligatorias
- `CLAUDE.md` y `.claude/` — los artefactos que consumen el contrato

## Paso 1 — Análisis de impacto

Para cada clave sin resolver (`⚠️ PENDIENTE` o `⚠️ SUPUESTO`), determina **qué
se rompe sin ella**: cuántos artefactos la referencian y qué agentes quedan
bloqueados.

| Prioridad | Criterio |
|---|---|
| 🔴 Bloqueante | Sin ella un agente no puede ni empezar: ramas, elemento de trabajo, comandos de prueba |
| 🟠 Alta | El agente puede trabajar, pero producirá algo incorrecto o inseguro |
| 🟡 Media | Afecta a la calidad o la coherencia, no a la corrección |
| 🔵 Baja | Solo aplica a escenarios que quizá no se den |

Detecta además:

- Claves de la plantilla **ausentes** del contrato.
- Claves con valor **contradictorio** con lo que hay en el repositorio.
- Claves **en blanco**, el peor estado: indistinguibles de un olvido.
- Si `docs/project.md` declara la topología `multirepo`,
  aplica además el apartado «Auditoría» de `.claude/skills/rama-espejo/SKILL.md`:
  `branch = .` en `.gitmodules`, pipeline de rama espejo y gitlinks de la rama
  base sin ramas temporales.

## Paso 2 — Entrevista

Presenta primero un resumen: cuántas lagunas hay por prioridad y cuáles son las
tres primeras. Después:

> **Una pregunta cada vez.** No agrupes. No pidas al usuario que responda a una
> lista.

Para cada pregunta:

1. Enuncia la clave y **por qué importa**: qué agente la usa y para qué.
2. Ofrece las **opciones habituales** cuando el abanico sea conocido, con una
   recomendación razonada si la tienes.
3. Acepta «no lo sé» → la clave queda `⚠️ PENDIENTE` con nota de quién debe
   decidirlo.
4. **Escribe la respuesta en `docs/project.md` inmediatamente**, antes de pasar
   a la siguiente. Nunca acumules cambios hasta el final: si la sesión se corta,
   lo respondido debe estar guardado.

Cuando una respuesta invalide otra clave ya escrita, dilo y corrígela.

## Paso 3 — Cierre

Informa de:

- Claves cerradas en esta sesión.
- Supuestos que siguen sin confirmar, con el riesgo de cada uno.
- Pendientes que quedan y **quién** debe decidirlos.
- Si el contrato ya es suficiente para trabajar, y con qué agentes.

## Prohibiciones

- No resuelvas una laguna por deducción propia: eso ya se hizo en el prompt 01.
  Lo que llega hasta aquí es justo lo que **requiere una decisión humana**.
- No des por buena una respuesta ambigua. Reformula hasta obtener un valor
  concreto.
- No toques secciones que no estén en discusión.


---

Contexto adicional del usuario: $ARGUMENTS

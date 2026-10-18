---
description: "14 · Revisa toda la documentación buscando lagunas, ambigüedades e incoherencias, y las resuelve una a una con el usuario."
argument-hint: "[contexto opcional]"
---

# 14 · Validación de la documentación

Eres un **arquitecto de software y analista de sistemas senior** con experiencia
en revisión de documentación técnica. Tu trabajo es encontrar lo que está mal
**antes** de que se convierta en código.

## Alcance

Toda la documentación que los agentes tratan como fuente de verdad:

`docs/project.md` · `docs/product.md` · `docs/architecture.md` ·
`docs/datamodel.md` · `$API_CONTRACT` · `$RBAC_MATRIX_DOC` ·
`docs/TESTING-STRATEGY.md` · `$CODE_STANDARDS_DOC` · `$STYLE_GUIDE_DOC` ·
`docs/backlog.md` · `$OPENSPEC_PATH`

## Qué buscas

| Tipo | Definición |
|---|---|
| **Laguna** | Información ausente o incompleta que debería estar |
| **Ambigüedad** | Enunciado interpretable de más de una manera |
| **Incoherencia** | Contradicción entre dos partes de la documentación |

La **incoherencia entre documentos** es la más peligrosa y la más difícil de
ver: cada documento es correcto por separado. Búscala activamente en los cruces:

- Entidad del modelo de datos ↔ esquema del contrato de API.
- Rol de la matriz de permisos ↔ seguridad declarada en cada operación.
- Regla crítica de permisos ↔ prueba que la verifica.
- Historia del backlog ↔ operación que la soporta en la API.
- Umbral de calidad ↔ lo realmente configurado en la integración continua.
- Estilo arquitectónico declarado ↔ estructura descrita en arquitectura.
- Funcionalidad prometida en producto ↔ existencia de contrato que la soporte.
- Historia del backlog ↔ capacidad declarada en los specs consolidados.

## Invariantes de OpenSpec

Además de lo anterior, verifica el modelo de specs. Son comprobaciones
mecánicas y su incumplimiento suele pasar inadvertido durante meses:

| Invariante | Por qué importa |
|---|---|
| Todo `#### Scenario:` de un change tiene al menos una tarea de prueba que lo cubre | Un escenario sin prueba es un requisito que nadie verifica |
| Las tareas de prueba **preceden** a las de implementación en cada capa | Es la condición que hace posible el ciclo rojo → verde |
| Ninguna tarea marcada `[x]` sin evidencia de prueba existente, fallida y luego superada | Una casilla marcada sin evidencia convierte la lista en decoración |
| Todo requisito usa SHALL o MUST y describe comportamiento **observable** | Un requisito que menciona una clase o una tabla no es un requisito |
| Los deltas usan cabeceras `ADDED` / `MODIFIED` / `REMOVED` / `RENAMED`; los consolidados **no** | Confundir ambos formatos rompe el volcado al archivar |
| Todo change archivado volcó su delta al spec consolidado | Un delta sin volcar deja la capacidad declarada como inexistente |
| Toda capacidad implementada aparece en el estado consolidado del proyecto | Un agente que la busque concluirá que hay que construirla de nuevo |
| Ningún spec consolidado se ha borrado; los sustituidos se marcan como obsoletos | Borrar un spec elimina la única traza de por qué algo se hizo así |

Comprueba también que **no hay criterios de aceptación en Given/When/Then fuera
de los specs**, en particular en `docs/backlog.md`. Es la duplicación más
probable y la que garantiza divergencia.

Busca además:

- Toda variable `⚠️ PENDIENTE` o `⚠️ SUPUESTO` que ya bloquee trabajo.
- Referencias a documentos o rutas que **no existen**.
- Requisitos no verificables: si no se puede escribir una prueba, no es un
  requisito.
- Decisiones sin coste ni alternativa declarada.

## Procedimiento

> **No presentes todos los hallazgos de golpe.**

### Paso 1
Analiza internamente y escribe el inventario completo en `docs/validacion.md`,
ordenado por gravedad. Formato de cada entrada:

```markdown
### Problema [N] de [Total]

- **Tipo**: Laguna | Ambigüedad | Incoherencia
- **Gravedad**: 🔴 bloqueante | 🟠 alta | 🟡 media | 🔵 baja
- **Ubicación**: <documento y sección; si es incoherencia, **las dos**>
- **Descripción**: <en qué consiste y qué se rompe si no se corrige>
- **Solución propuesta**: <concreta y justificada; alternativas si las hay>
- **Estado**: pendiente
```

### Paso 2
Presenta al usuario **solo el resumen**: cuántos problemas por gravedad y cuáles
son los tres primeros.

### Paso 3
Recorredlos **uno a uno**. En cada uno el usuario puede aceptar, rechazar,
modificar o pedir alternativas.

Cuando se acuerde una solución:

1. **Aplícala al documento afectado.**
2. Marca la entrada como resuelta en `docs/validacion.md`, con la decisión.
3. Comprueba si la corrección invalida otro hallazgo de la lista, y actualízalo.
4. Solo entonces pasa al siguiente.

## Reglas

- No corrijas nada sin acuerdo explícito, ni siquiera lo evidente.
- No cuentes como hallazgo una diferencia de estilo o redacción.
- Si un problema nace de una decisión de negocio pendiente, no propongas una
  solución técnica: identifica **quién** debe decidir.
- Al terminar, informa de qué queda abierto y por qué.

## Salida

```
docs/validacion.md   ← inventario con el estado de cada problema
```

Más las correcciones aplicadas a los documentos afectados.


---

Contexto adicional del usuario: $ARGUMENTS

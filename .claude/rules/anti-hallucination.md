---
paths:
  - "services/**"
  - "apps/**"
  - "packages/**"
  - "db/**"
---

# Reglas anti-alucinación — código fuente

Aplican a todo el código, en cualquier lenguaje. Lo específico del proyecto
vive en `docs/project.md`: si falta una clave, **para y pregunta**.

## Antes de implementar cualquier cosa

1. **Lee el contrato antes de implementar.** Verifica en `$API_CONTRACT` que el
   endpoint, campo o parámetro que vas a usar existe. Si no está en el contrato,
   no lo inventes: detente y pide clarificación.

2. **Verifica que el tipo existe.** Antes de referenciar una entidad, enumerado,
   DTO o servicio, confirma con una búsqueda que está en el repositorio. No
   asumas que existe porque «parece que debería estar».

3. **No inventes valores de un enumerado.** Los valores válidos de los
   enumerados de dominio (estados, roles, niveles de riesgo, tipos) se leen del
   código fuente o de `$API_CONTRACT`. Nunca supongas un valor.

4. **No inventes roles ni permisos.** Los autorizados para cada acción están en
   `$RBAC_MATRIX_DOC`. No añadas ninguno que no figure en esa matriz.

5. **No modifiques el esquema de datos sin confirmación.** Si un cambio exige
   alterar una tabla, colección o añadir un campo persistido, detente y confirma
   antes de escribir la migración.

## Durante la implementación

- Si una prueba falla porque falta un tipo o una función, **búscalo primero**
  antes de asumir que hay que crearlo.
- Si no encuentras una importación, **búscala en el proyecto** antes de elegir
  una biblioteca alternativa. Añadir una dependencia es una decisión, no un
  atajo para resolver un import.
- Si un comportamiento no está especificado en el `design.md` del change activo,
  **no lo implementes**: regístralo como pregunta abierta.

## Nunca

- Inventar campos de petición o respuesta que no estén en `$API_CONTRACT`.
- Inventar transiciones de estado que no estén en el modelo de dominio.
- Dar por hecho que una función o tipo existe sin verificarlo con una búsqueda.
- Cambiar lógica de negocio existente sin que se haya solicitado explícitamente.

## Cómo se declara lo que no se sabe

Cuando falte información, la salida correcta **no es una suposición plausible**:
es una pregunta. Marca el hueco de forma que sea imposible pasarlo por alto y
continúa solo con lo que sí está confirmado.

Una suposición silenciosa es más cara que un bloqueo: el bloqueo se resuelve en
una conversación, la suposición se descubre en producción.

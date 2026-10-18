---
description: "Use when creating or modifying server-side business logic (application use cases and domain services). Enforces naming, layer boundaries, transaction discipline, business validation and error handling. Stack-agnostic."
paths:
  - "services/api/src/{application,domain}/**"
---

# Convenciones de servicios y casos de uso

> Reglas genéricas. Todo lo específico del proyecto vive en `docs/project.md`.
> Ajusta los `paths` del frontmatter de este fichero a la estructura real del proyecto durante
> el arranque.

## Nomenclatura

- Los casos de uso de aplicación viven bajo `application/usecase/**`; los
  servicios de dominio bajo `domain/service/**`.
- El nombre refleja la intención y el dominio, en el lenguaje del negocio,
  no en el de la tecnología.
- Los métodos públicos usan verbos de intención: crear, actualizar, transicionar,
  validar, calcular, aprobar, rechazar.
- Sigue la convención idiomática de `$LANGUAGE` para mayúsculas y sufijos.

## Fronteras de capa

- Los servicios son dueños de la lógica de negocio y de la validación semántica.
- Los adaptadores de entrada no contienen reglas de negocio; los servicios no
  contienen preocupaciones de transporte.
- Los repositorios son dependencias exclusivamente de persistencia: mantén los
  detalles de consulta fuera de las reglas de negocio.
- Los servicios de aplicación **orquestan** objetos y servicios de dominio a
  través de puertos; no deben convertirse en adaptadores de infraestructura.
- Las invariantes del dominio viven en `domain/**`, no escondidas dentro de un
  servicio de aplicación cuando pertenecen al modelo.
- Depende de puertos e interfaces, no de adaptadores concretos.

## Transacciones

- Define las fronteras transaccionales en la capa de servicio, nunca en el
  adaptador de entrada ni en el repositorio.
- Marca explícitamente las operaciones de solo lectura como tales.
- Mantén las transacciones lo más cortas posible.
- **Nunca** realices llamadas remotas dentro de una transacción abierta.
- Garantiza la atomicidad de las transiciones de estado y sus efectos
  secundarios cuando la regla de negocio lo exija.

## Validación

- Separa la validación sintáctica (formato de la entrada) de la semántica
  (consistencia de negocio).
- Ejecuta todas las validaciones semánticas críticas **antes** de mutar estado
  persistente.
- Nunca confíes en permisos, roles ni estados de flujo proporcionados por el
  cliente.

## Manejo de errores

- Distingue los errores de negocio de los técnicos.
- Usa errores de dominio explícitos para las violaciones de regla: deterministas
  y verificables por test.
- No uses la ausencia de valor como señal de error: devuelve un valor explícito
  o lanza un error tipado.
- No filtres detalles internos de seguridad ni datos sensibles en los mensajes.

## Seguridad y control de acceso

- Centraliza las decisiones de autorización en un evaluador o servicio único,
  no dispersas por los métodos.
- Aplica la segregación de funciones en los puntos de decisión del servicio.

## Tests y cobertura

- Todo cambio de comportamiento requiere tests.
- Cubre el camino feliz, el de violación de regla y al menos un caso límite por
  método modificado.
- Incluye tests basados en propiedades para invariantes, flujos y cálculos.
- Cobertura `>= $COVERAGE_THRESHOLD` según `docs/TESTING-STRATEGY.md`
  (fuente autoritativa).

## Salvaguardas

- No inventes contratos, campos de petición ni estados de dominio que no estén
  en `$API_CONTRACT`, en el `design.md`/`proposal.md` del change o en el spec.
- Si el contrato o el spec es ambiguo, **para y pide clarificación**.
- No introduzcas preocupaciones de transporte, de objetos de transferencia del
  adaptador ni del framework de persistencia dentro de las reglas de negocio.

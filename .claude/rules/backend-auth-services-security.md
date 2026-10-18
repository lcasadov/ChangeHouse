---
description: "Use when creating or modifying authentication/authorization services outside the central security configuration. Reinforces identity, session and credential handling, RBAC consistency and auth-focused testing. Stack-agnostic."
paths:
  - "services/api/src/**/auth/**"
  - "services/api/src/**/{authentication,authorization,identity}/**"
---

# Convenciones de servicios de autenticación y autorización

> Reglas genéricas. Todo lo específico del proyecto vive en `docs/project.md`.
> Ajusta los `paths` del frontmatter de este fichero a la estructura real del proyecto durante
> el arranque.

## Alcance

- Aplica a los servicios de la capa de autenticación situados **fuera** de la
  configuración central de seguridad: servicio de autenticación, servicio de
  sesión, carga de datos del usuario y servicios de autorización.
- Estas carpetas pueden no existir todavía: esta guía se activa cuando se
  implementa la capacidad de autenticación y control de acceso del proyecto.
- Úsala junto con las convenciones de seguridad transversal.

## Responsabilidades y fronteras

- Mantén separadas y explícitas las preocupaciones de **autenticación**
  (quién eres) y de **autorización** (qué puedes hacer).
- Estos servicios pueden orquestar flujos de identidad, sesión y credenciales,
  pero nunca contienen preocupaciones de transporte.
- No dupliques la lógica de análisis y verificación de credenciales entre
  servicios: centralízala y reutilízala.

## Reglas de seguridad

- El servidor es la fuente de verdad de la identidad y de los permisos.
- Nunca confíes en roles ni estado de sesión enviados por el cliente.
- Aplica mínimo privilegio y flujo de decisión deny-by-default.
- Rechaza de forma determinista las credenciales inválidas, expiradas o revocadas.
- Evita la enumeración de usuarios y la filtración de detalles sensibles en los
  errores de autenticación.

## Sesión y credenciales

- Ciclo de vida determinista: emisión, validación, renovación o revocación
  cuando aplique, y cierre.
- El cierre de sesión invalida efectivamente el estado de autenticación.
- **Nunca** registres credenciales en claro, secretos, contraseñas ni
  afirmaciones sensibles.

## Consistencia de la autorización

- Delega las decisiones de permiso en el evaluador centralizado.
- Evita comprobaciones de rol dispersas y reglas contradictorias.
- Aplica la segregación de funciones donde el flujo de negocio lo requiera.

## Errores y auditoría

- Distingue el fallo de autenticación (no autenticado) del fallo de autorización
  (prohibido).
- Devuelve semántica de error estable y mínima, sin detalles internos.
- Garantiza que los eventos relevantes son auditables: intentos fallidos,
  invalidación de sesión y denegaciones de acceso.

## Tests y cobertura

Todo cambio requiere tests. Cubre como mínimo:

- Camino de autenticación válido
- Credencial con firma inválida
- Credencial expirada
- Invalidación de sesión y cierre
- Resultados permitido frente a denegado

Añade tests basados en propiedades sobre las invariantes de credenciales y de
autorización cuando aplique.
Cobertura `>= $COVERAGE_THRESHOLD` según `docs/TESTING-STRATEGY.md`
(fuente autoritativa).

## Salvaguardas

- No inventes endpoints, afirmaciones ni roles que no estén en los requisitos o
  en el diseño.
- Si el contrato de autenticación es ambiguo, **para y pide clarificación**.

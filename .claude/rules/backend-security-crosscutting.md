---
description: "Use when creating or modifying cross-cutting security infrastructure on the server side (central security configuration, authentication filters, token providers, permission evaluators). Stack-agnostic."
paths:
  - "backend/**/{config,configuration,security}/**"
  - "server/**/{config,configuration,security}/**"
  - "api/**/{config,configuration,security}/**"
  - "**/src/main/**/{config,security}/**"
---

# Convenciones de seguridad transversal

> Reglas genéricas. Todo lo específico del proyecto vive en `docs/project.md`.
> Ajusta los `paths` del frontmatter de este fichero a la estructura real del proyecto durante
> el arranque.

## Alcance

- Aplica a la infraestructura de seguridad: configuración central, proveedores y
  filtros de autenticación, evaluadores de permisos, representación del principal
  autenticado y filtros de petición.
- Trata estas clases como **código de ruta crítica**: revisión y pruebas estrictas.
- Son adaptadores de infraestructura, no contenedores de reglas de negocio.

## Postura de seguridad (obligatoria)

- Autorización **deny-by-default**.
- Todos los endpoints no públicos protegidos salvo exclusión explícita y documentada.
- Preserva el modelo de autenticación definido en `$AUTH_MECHANISM`. No lo cambies
  salvo que un requisito lo exija de forma explícita.
- Nunca confíes en afirmaciones de rol o permiso enviadas por el cliente sin
  verificación en servidor.

## Disciplina de credenciales y filtros

- Valida firma, vigencia e integridad de la credencial en **cada** petición
  autenticada.
- Rechaza las credenciales malformadas o inválidas de forma determinista.
- Ninguna lógica de negocio dentro de un filtro de seguridad.
- Cada filtro tiene una única responsabilidad (autenticar, limitar tasa, etc.).
- El orden de los filtros es explícito y está justificado.
- La infraestructura de seguridad depende de las abstracciones de autorización de
  la aplicación, nunca al revés.

## Control de acceso

- Centraliza la comprobación de permisos en un evaluador o servicio de
  autorización único.
- Evita lógica de roles duplicada en clases no relacionadas.
- Aplica la segregación de funciones en las decisiones de autorización.
- Cubre **siempre** en los tests tanto el caso permitido como el denegado.

## Errores y registro seguros

- Nunca registres ni expongas secretos, credenciales, contenido de tokens,
  internos de la pila ni matrices de permisos.
- Mensajes de error de seguridad estables y mínimos hacia el cliente.
- Mantén rastro de auditoría de los accesos denegados y de los eventos críticos
  de seguridad.

## Foco de endurecimiento OWASP

- Control de acceso roto
- Fallos criptográficos (gestión de credenciales y secretos)
- Mala configuración de seguridad
- Fallos de identificación y autenticación
- Propagación de inyecciones a través de la frontera de seguridad
- Fallos de registro y monitorización

## Tests y cobertura

- Todo cambio en la infraestructura de seguridad requiere tests.
- Cubre: autenticación válida, credencial inválida, credencial expirada,
  credencial ausente y acceso prohibido.
- Cubre el comportamiento de los filtros de forma determinista, incluidos los
  caminos de error.
- Cobertura `>= $COVERAGE_THRESHOLD` según `docs/TESTING-STRATEGY.md`
  (fuente autoritativa).

## Reglas de seguridad del cambio

- Prefiere cambios mínimos y reversibles en las clases de seguridad.
- Documenta la justificación de cualquier exclusión o excepción introducida.
- Si un cambio **debilita** la postura de seguridad, **para y solicita aprobación
  explícita** exponiendo el riesgo.

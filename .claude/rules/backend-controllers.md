---
description: "Use when creating or modifying inbound transport adapters on the server side (REST/HTTP controllers, handlers, resources). Enforces DTO mapping, status-code discipline and endpoint security. Stack-agnostic."
paths:
  - "backend/**/{rest,http,web,controller,controllers,handlers}/**"
  - "server/**/{rest,http,controller,controllers,handlers}/**"
  - "api/**/{rest,http,controller,controllers,handlers}/**"
  - "**/src/main/**/{rest,controller,controllers}/**"
---

# Convenciones de adaptadores de entrada (controladores)

> Reglas genéricas. Todo lo específico del proyecto vive en `docs/project.md`.
> Ajusta los `paths` del frontmatter de este fichero a la estructura real del proyecto durante
> el arranque.

## Nomenclatura y responsabilidad

- El nombre de la clase o del módulo refleja que es un adaptador de entrada,
  siguiendo la convención idiomática de `$LANGUAGE`.
- Los controladores orquestan **solo el transporte**: análisis de la petición,
  mapeo a objetos de transferencia, códigos de estado y delegación.
- Ninguna regla de negocio en un controlador. Se delega en la capa de aplicación.
- Un controlador nunca llama directamente a repositorios ni a clientes externos:
  siempre a un caso de uso o servicio de aplicación.

## Objetos de transferencia

- Usa objetos de petición y respuesta explícitos en la frontera de la API.
- **Nunca** expongas entidades internas o de persistencia en las respuestas.
- Valida la entrada con el mecanismo de validación declarativa de `$FRAMEWORK`,
  activado explícitamente en cada operación.
- Mapeo defensivo: normaliza o recorta donde proceda, sin alterar el significado
  de negocio.

## Semántica HTTP

Códigos de estado consistentes:

| Código | Uso |
|---|---|
| 200 | Lectura o actualización correcta |
| 201 | Creación, con cabecera de localización cuando aplique |
| 204 | Operación correcta sin contenido de respuesta |
| 400 | Error de validación o sintáctico |
| 401 | Petición no autenticada |
| 403 | Petición autenticada pero no autorizada |
| 404 | Recurso no encontrado |
| 409 | Conflicto de negocio determinista o violación de regla |

Las respuestas deben ser deterministas y estables para la misma entrada y estado.

## Seguridad

- **Ningún endpoint sin control de acceso explícito.**
- Protege toda operación que modifique estado mediante el mecanismo de
  autorización a nivel de método de `$FRAMEWORK`, o mediante un punto central
  equivalente.
- Los endpoints públicos se documentan explícitamente y deben coincidir con la
  lista de exclusión declarada en la configuración central de seguridad.
- Nunca bases una decisión de autorización en información enviada por el cliente.

## Contrato de error

- Canaliza las excepciones a través del manejo centralizado de errores.
- No filtres trazas, nombres de rol ni detalles internos de autorización en las
  respuestas de la API.

## Auditoría

Para acciones críticas (transiciones de flujo, aprobaciones, operaciones
relevantes para la seguridad), asegura que la ruta de servicio subyacente
registra el evento de auditoría correspondiente.

## Tests y cobertura

- Todo cambio en un controlador requiere tests.
- Verifica: validación de la petición, mapeo de códigos de estado, caminos de
  autorización permitido **y** denegado, y respuestas de error representativas.
- Cobertura `>= $COVERAGE_THRESHOLD` según `docs/TESTING-STRATEGY.md`
  (fuente autoritativa).

## Salvaguardas

- No inventes campos ni endpoints fuera de `$API_CONTRACT`, del `design.md` o
  `proposal.md` del change, o del spec correspondiente.
- Si el contrato del endpoint es ambiguo, **para y pide clarificación** antes de
  implementar.
- No traslades decisiones de dominio o de persistencia al controlador para
  saltarte la capa de aplicación.

---
description: "Use when creating or modifying outbound API adapters on the client side. Enforces naming, structure, API contract discipline and test coverage. Stack-agnostic."
paths:
  - "apps/mobile/src/**/{api,services}/**"
---

# Convenciones de adaptadores de salida de API

> Reglas genéricas. Todo lo específico del proyecto vive en `docs/project.md`.
> Ajusta los `paths` del frontmatter de este fichero a la estructura real del proyecto durante
> el arranque.

## Nomenclatura

- Un fichero por recurso o capacidad del backend, con nombre consistente en todo
  el proyecto.
- Las funciones exportadas describen la operación, no el verbo de transporte.
- Nombres alineados con el lenguaje del dominio del proyecto.

## Estructura

- Un adaptador por recurso; sin adaptadores multipropósito.
- Orden recomendado: importaciones, configuración del cliente, tipos, funciones
  exportadas.
- Estos adaptadores implementan los puertos de salida definidos por la
  aplicación: son la **única** capa que conoce detalles de transporte.
- El cliente de red configurado (`$HTTP_CLIENT`) se define en un único punto y se
  reutiliza. No instancies clientes ad-hoc por fichero.
- Devuelve datos ya desenvueltos y tipados. No propagues el objeto de respuesta
  del transporte hacia arriba.
- Ningún estado de interfaz ni preocupación de renderizado en esta capa.

## Disciplina de contrato

- Rutas, métodos, parámetros y formas de petición y respuesta se toman de
  `$API_CONTRACT`.
- **No inventes** endpoints, campos, enumerados ni códigos de estado.
- Si el contrato es ambiguo o falta, **para y pide clarificación**.
- Los cambios de contrato se reflejan primero en `$API_CONTRACT`, después en el
  adaptador.
- Convierte la forma del transporte en modelos del dominio del cliente cuando
  difieran; no filtres la forma del backend a toda la aplicación.

## Errores y resiliencia

- Normaliza los errores a una forma única y estable que las capas superiores
  puedan consumir.
- Distingue error de red, error del cliente y error del servidor.
- Nunca registres credenciales, cabeceras de autenticación ni datos personales.
- No implementes reintentos silenciosos salvo que el proyecto lo defina de forma
  explícita.
- Propaga la cancelación cuando el transporte lo soporte.

## Tests y cobertura

- Añade o actualiza tests en cada adaptador nuevo o modificado.
- Cubre: respuesta correcta, mapeo de la respuesta, error del cliente, error del
  servidor y fallo de red.
- Usa un doble de prueba en el límite de transporte; no llames a servicios reales.
- Verifica que la ruta, el método y la carga enviada coinciden con `$API_CONTRACT`.
- Al menos un caso límite: colección vacía, campo opcional ausente o paginación.
- Cobertura `>= $COVERAGE_THRESHOLD` según `docs/TESTING-STRATEGY.md`
  (fuente autoritativa).

## Salvaguardas

- No modifiques código de servidor desde tareas de esta capa.
- No introduzcas lógica de negocio aquí: solo transporte y mapeo.
- No dupliques la configuración de autenticación: se resuelve en el cliente
  compartido.

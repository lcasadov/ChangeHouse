# api-errors Specification

## Purpose
Formato único de los errores de la API de ChangeHouse, para que los clientes los
traten igual en todas las operaciones y el equipo pueda diagnosticarlos sin
exponer detalles internos.

## Requirements

### Requirement: Formato único de error

Toda respuesta de error de la API SHALL usar el tipo de contenido
`application/problem+json` con los campos `type`, `title`, `status` y
`correlationId`, y `errors` por campo en los errores de validación; MUST NOT
incluir trazas, consultas SQL ni nombres de tablas; y el mismo `correlationId`
SHALL aparecer en el registro del servidor.

#### Scenario: Error de validación
- **GIVEN** una petición con un cuerpo que no cumple el esquema
- **WHEN** la API la rechaza
- **THEN** responde 400 en `application/problem+json` con `errors` que señalan cada campo y un `correlationId`

#### Scenario: Ruta inexistente
- **GIVEN** una petición a una ruta que no existe
- **WHEN** la API responde
- **THEN** devuelve 404 en formato `Problem` con `correlationId`

#### Scenario: Error inesperado sin detalles internos
- **GIVEN** un fallo no controlado durante una petición
- **WHEN** la API responde
- **THEN** devuelve 500 en formato `Problem` sin traza, sin SQL y sin nombres internos, y el registro del servidor contiene el mismo `correlationId` con el detalle del fallo

#### Scenario: Correlación propagada
- **GIVEN** una petición con la cabecera `X-Correlation-Id`
- **WHEN** la API responde con un error
- **THEN** el `correlationId` de la respuesta es el recibido en la cabecera

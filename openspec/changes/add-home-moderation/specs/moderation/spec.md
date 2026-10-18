# Spec Delta

## Purpose

Moderación por el equipo de ChangeHouse: qué se revisa antes de publicarse,
quién decide y qué rastro queda de cada decisión.

## ADDED Requirements

### Requirement: Cola de moderación de viviendas

Un usuario con rol `admin` SHALL ver las viviendas en `in_review` ordenadas de
la más antigua a la más reciente, con su ficha completa y sus fotos; ningún otro
rol MUST acceder a la cola.

#### Scenario: Ver la cola
- **GIVEN** dos viviendas en `in_review` enviadas en días distintos
- **WHEN** un admin abre la cola de moderación
- **THEN** ve primero la enviada antes, con su ficha y sus fotos

#### Scenario: Cola vacía
- **GIVEN** que no hay viviendas en revisión
- **WHEN** un admin abre la cola
- **THEN** ve un estado vacío que indica que no hay nada pendiente

#### Scenario: Usuario sin rol de administración
- **GIVEN** un usuario `owner` o `seeker`
- **WHEN** intenta acceder a la cola
- **THEN** la API responde 403 y la app no muestra la sección de administración

### Requirement: Aprobación y rechazo con motivo

Un admin SHALL poder aprobar una vivienda en `in_review`, que pasa a
`published`, o rechazarla con un motivo obligatorio, que la devuelve a `draft`
con el motivo visible para su propietario; una vivienda que no está en
`in_review` MUST NOT poder moderarse.

#### Scenario: Aprobar
- **GIVEN** una vivienda en `in_review`
- **WHEN** un admin la aprueba
- **THEN** pasa a `published` y su propietario pasa a tener el rol `owner`

#### Scenario: Rechazar con motivo
- **GIVEN** una vivienda en `in_review`
- **WHEN** un admin la rechaza indicando «Las fotos no corresponden a la vivienda»
- **THEN** vuelve a `draft` y su propietario ve ese motivo en «Mis casas»

#### Scenario: Rechazar sin motivo
- **GIVEN** una vivienda en `in_review`
- **WHEN** un admin intenta rechazarla sin motivo
- **THEN** la API responde 400 y la vivienda sigue en revisión

#### Scenario: Moderar algo que no está en revisión
- **GIVEN** una vivienda en `draft`
- **WHEN** un admin intenta aprobarla
- **THEN** la API responde 409

### Requirement: Registro de auditoría de la moderación

Cada aprobación o rechazo SHALL quedar registrado con quién lo hizo, qué
decidió, sobre qué vivienda y cuándo; el registro MUST ser de solo inserción y
SHALL escribirse en la misma transacción que la decisión.

#### Scenario: Decisión auditada
- **GIVEN** un admin que rechaza una vivienda
- **WHEN** termina la operación
- **THEN** existe una entrada de auditoría con el admin, la acción «rechazar», la vivienda y la fecha

#### Scenario: Sin auditoría no hay decisión
- **GIVEN** un fallo al escribir la entrada de auditoría
- **WHEN** un admin aprueba una vivienda
- **THEN** la vivienda no cambia de estado y la API responde con error

# Spec Delta

## ADDED Requirements

### Requirement: Suspender y reactivar usuarios

Un admin SHALL poder suspender a un usuario indicando un motivo obligatorio y
reactivarlo después; cada acción SHALL quedar en el registro de auditoría; un
admin MUST NOT poder suspenderse a sí mismo.

#### Scenario: Suspender con motivo
- **GIVEN** un usuario con denuncias resueltas
- **WHEN** un admin lo suspende con el motivo «Fraude reiterado»
- **THEN** el usuario queda suspendido y existe la entrada de auditoría

#### Scenario: Sin motivo
- **GIVEN** un admin suspendiendo a un usuario
- **WHEN** no indica motivo
- **THEN** la API responde 400

### Requirement: Efecto de la suspensión

Un usuario suspendido SHALL recibir 403 con el código `ACCOUNT_SUSPENDED` en
toda operación salvo la consulta de su cuenta y la exportación de sus datos; sus
viviendas MUST NOT aparecer en el descubrimiento ni formar matches nuevos, y sus
matches abiertos SHALL cerrarse para todos; al reactivarlo recupera el acceso,
pero no los matches cerrados.

#### Scenario: Usuario suspendido usa la app
- **GIVEN** un usuario suspendido
- **WHEN** abre la app
- **THEN** ve la pantalla de cuenta suspendida y solo puede exportar sus datos o cerrar sesión

#### Scenario: Sus viviendas desaparecen
- **GIVEN** un usuario suspendido con una vivienda publicada y un match abierto
- **WHEN** otros usuarios consultan el descubrimiento y el match
- **THEN** su vivienda no aparece y el match está cerrado

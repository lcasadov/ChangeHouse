# Spec Delta

## ADDED Requirements

### Requirement: Eliminar la cuenta

Un usuario SHALL poder eliminar su cuenta desde la app tras confirmarlo dos
veces; el sistema SHALL anonimizar su email, nombre visible y teléfono, cerrar
sus viviendas, cerrar para todos sus matches abiertos, borrar sus dispositivos y
preferencias y darle de baja en el proveedor de identidad; SHALL conservar sus
consentimientos y las entradas de auditoría; y el email MUST quedar libre para un
registro futuro.

#### Scenario: Eliminación completa
- **GIVEN** un usuario con una vivienda publicada y un match abierto
- **WHEN** elimina su cuenta y lo confirma
- **THEN** su vivienda pasa a `closed`, el match se cierra para el otro participante, su sesión termina y no puede volver a entrar con esa cuenta

#### Scenario: Datos tras la eliminación
- **GIVEN** una cuenta eliminada
- **WHEN** se consulta lo que queda en el sistema
- **THEN** no hay email, nombre ni teléfono reconocibles, y siguen existiendo sus consentimientos con versión y fecha

#### Scenario: Doble confirmación
- **GIVEN** un usuario que pulsa «Eliminar mi cuenta»
- **WHEN** aparece la confirmación
- **THEN** se le explica qué se borra y qué se conserva, y debe escribir «ELIMINAR» para continuar

### Requirement: Exportar mis datos

Un usuario SHALL poder descargar en JSON sus datos personales —cuenta,
viviendas, preferencias, me gusta, descartes, matches en los que participa y
consentimientos— sin incluir datos personales de otros usuarios.

#### Scenario: Exportación
- **GIVEN** un usuario con viviendas y un match
- **WHEN** pide exportar sus datos
- **THEN** recibe un JSON con sus datos y, del match, solo su participación y el identificador de las otras viviendas, sin nombres, teléfonos ni direcciones ajenas

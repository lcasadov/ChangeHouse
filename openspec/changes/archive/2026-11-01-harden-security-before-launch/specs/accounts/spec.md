# Spec Delta

## ADDED Requirements

### Requirement: Borrar el teléfono

Un usuario SHALL poder borrar el teléfono guardado en su perfil. Al hacerlo,
ninguna respuesta de la API SHALL devolverlo a nadie, tampoco en los matches
donde lo había autorizado.

#### Scenario: Borrar el teléfono del perfil
- **GIVEN** un usuario con teléfono guardado y autorizado en un match abierto
- **WHEN** vacía el campo del teléfono en su perfil y guarda
- **THEN** su cuenta ya no tiene teléfono y el otro participante del match deja de verlo

## MODIFIED Requirements

### Requirement: Eliminar la cuenta

Un usuario SHALL poder eliminar su cuenta desde la app tras confirmarlo dos
veces. Al hacerlo, el sistema SHALL:
- anonimizar su email, nombre visible y teléfono;
- cerrar sus viviendas y borrar de ellas la dirección exacta y la ubicación
  exacta;
- cerrar para todos sus matches abiertos y retirar las autorizaciones de su
  teléfono;
- borrar sus dispositivos y preferencias;
- darle de baja en el proveedor de identidad.

SHALL conservar sus consentimientos y las entradas de auditoría, y el email MUST
quedar libre para un registro futuro.

#### Scenario: Eliminación completa
- **GIVEN** un usuario con una vivienda publicada y un match abierto
- **WHEN** elimina su cuenta y lo confirma
- **THEN** su vivienda pasa a `closed`, el match se cierra para el otro participante, su sesión termina y no puede volver a entrar con esa cuenta

#### Scenario: Datos tras la eliminación
- **GIVEN** una cuenta eliminada
- **WHEN** se consulta lo que queda en el sistema
- **THEN** no hay email, nombre, teléfono ni dirección o ubicación exactas de sus viviendas reconocibles, y siguen existiendo sus consentimientos con versión y fecha

#### Scenario: El otro participante pierde los datos de contacto
- **GIVEN** un match abierto en el que veía la dirección exacta y el teléfono de otro usuario
- **WHEN** ese usuario elimina su cuenta
- **THEN** al abrir el match ya no veo su dirección exacta ni su teléfono

#### Scenario: Doble confirmación
- **GIVEN** un usuario que pulsa «Eliminar mi cuenta»
- **WHEN** aparece la confirmación
- **THEN** se le explica qué se borra y qué se conserva, y debe escribir «ELIMINAR» para continuar

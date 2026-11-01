# Spec Delta

## MODIFIED Requirements

### Requirement: Bloquear a un usuario

Un usuario SHALL poder bloquear a otro. Desde ese momento ninguno de los dos SHALL
ver las viviendas del otro en el descubrimiento ni formar matches nuevos entre
ellos. Los matches `open` o `confirmed` en los que participan los dos SHALL
cerrarse para todos sus participantes, con lo que su chat queda en solo lectura.
Quien bloquea MUST NOT recibir avisos de esos matches.

#### Scenario: Efecto del bloqueo
- **GIVEN** que bloqueo a un usuario cuyas viviendas aparecían en mis tarjetas
- **WHEN** consulto el descubrimiento
- **THEN** sus viviendas ya no aparecen, y las mías tampoco en el suyo

#### Scenario: Sin matches nuevos
- **GIVEN** dos usuarios bloqueados entre sí con «Me gusta» cruzados
- **WHEN** uno da el «Me gusta» que cerraría el ciclo
- **THEN** no se crea ningún match

#### Scenario: El bloqueo cierra el match y su chat
- **GIVEN** un match abierto con un usuario que me está escribiendo
- **WHEN** lo bloqueo
- **THEN** el match se cierra para todos, su chat queda en solo lectura y un mensaje nuevo suyo se rechaza

### Requirement: Efecto de la suspensión

Un usuario suspendido SHALL recibir 403 con el código `ACCOUNT_SUSPENDED` en
toda operación salvo tres: la consulta de su cuenta, la exportación de sus datos
y la eliminación de su cuenta. Sus viviendas MUST NOT aparecer en el
descubrimiento ni formar matches nuevos, y sus matches abiertos SHALL cerrarse
para todos. Al reactivarlo recupera el acceso, pero no los matches cerrados. Si
elimina su cuenta, sus denuncias y las entradas de auditoría SHALL conservarse.

#### Scenario: Usuario suspendido usa la app
- **GIVEN** un usuario suspendido
- **WHEN** abre la app
- **THEN** ve la pantalla de cuenta suspendida y solo puede exportar sus datos, eliminar su cuenta o cerrar sesión

#### Scenario: Sus viviendas desaparecen
- **GIVEN** un usuario suspendido con una vivienda publicada y un match abierto
- **WHEN** otros usuarios consultan el descubrimiento y el match
- **THEN** su vivienda no aparece y el match está cerrado

#### Scenario: Usuario suspendido elimina su cuenta
- **GIVEN** un usuario suspendido con denuncias resueltas en su contra
- **WHEN** elimina su cuenta y lo confirma
- **THEN** la cuenta queda eliminada y las denuncias y la auditoría de su suspensión siguen existiendo

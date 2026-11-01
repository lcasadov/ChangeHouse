# moderation Specification

## Purpose
Moderación por el equipo de ChangeHouse: qué se revisa antes de publicarse,
quién decide y qué rastro queda de cada decisión.

## Requirements

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

### Requirement: Denunciar

Un usuario SHALL poder denunciar a otro usuario, una vivienda o un mensaje de un
chat en el que participa, indicando un motivo; la denuncia de un mensaje SHALL
guardar una copia del mensaje como evidencia; el número de denuncias por usuario
SHALL estar limitado.

#### Scenario: Denunciar una vivienda
- **GIVEN** una tarjeta de vivienda
- **WHEN** el usuario la denuncia con el motivo «Anuncio falso»
- **THEN** la API responde 201 y la app confirma que el equipo la revisará

#### Scenario: Denunciar un mensaje
- **GIVEN** un mensaje ofensivo en un chat en el que participo
- **WHEN** lo denuncio
- **THEN** la denuncia guarda el texto del mensaje, su remitente y su fecha

#### Scenario: Mensaje de un chat ajeno
- **GIVEN** un mensaje de un chat en el que no participo
- **WHEN** intento denunciarlo
- **THEN** la API responde 404

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

### Requirement: Revisión de denuncias

Un admin SHALL ver las denuncias abiertas, de la más antigua a la más reciente,
con su evidencia, y SHALL poder resolverlas o desestimarlas con una nota; cada
resolución SHALL quedar en el registro de auditoría.

#### Scenario: Resolver una denuncia
- **GIVEN** una denuncia abierta
- **WHEN** un admin la resuelve con una nota
- **THEN** pasa a `resolved` y queda una entrada de auditoría con el admin, la acción y la fecha

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

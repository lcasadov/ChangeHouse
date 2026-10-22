# Spec Delta

## ADDED Requirements

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

Un usuario SHALL poder bloquear a otro; desde ese momento ninguno de los dos
SHALL ver las viviendas del otro en el descubrimiento ni formar matches nuevos
entre ellos.

#### Scenario: Efecto del bloqueo
- **GIVEN** que bloqueo a un usuario cuyas viviendas aparecían en mis tarjetas
- **WHEN** consulto el descubrimiento
- **THEN** sus viviendas ya no aparecen, y las mías tampoco en el suyo

#### Scenario: Sin matches nuevos
- **GIVEN** dos usuarios bloqueados entre sí con «Me gusta» cruzados
- **WHEN** uno da el «Me gusta» que cerraría el ciclo
- **THEN** no se crea ningún match

### Requirement: Revisión de denuncias

Un admin SHALL ver las denuncias abiertas, de la más antigua a la más reciente,
con su evidencia, y SHALL poder resolverlas o desestimarlas con una nota; cada
resolución SHALL quedar en el registro de auditoría.

#### Scenario: Resolver una denuncia
- **GIVEN** una denuncia abierta
- **WHEN** un admin la resuelve con una nota
- **THEN** pasa a `resolved` y queda una entrada de auditoría con el admin, la acción y la fecha

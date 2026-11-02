# Spec Delta

## MODIFIED Requirements

### Requirement: Cola de moderación de viviendas

Un usuario con rol `admin` SHALL ver las viviendas en `in_review` (las retiradas
por una denuncia y las rechazadas que se han reenviado) ordenadas de la más
antigua a la más reciente según su entrada en la cola, con su ficha completa y
sus fotos; ningún otro rol MUST acceder a la cola.

#### Scenario: Ver la cola
- **GIVEN** dos viviendas retiradas por denuncia en días distintos
- **WHEN** un admin abre la cola de moderación
- **THEN** ve primero la retirada antes, con su ficha y sus fotos

#### Scenario: Cola vacía
- **GIVEN** que no hay viviendas en revisión
- **WHEN** un admin abre la cola
- **THEN** ve un estado vacío que indica que no hay nada pendiente

#### Scenario: Usuario sin rol de administración
- **GIVEN** un usuario `owner` o `seeker`
- **WHEN** intenta acceder a la cola
- **THEN** la API responde 403 y la app no muestra la sección de administración

### Requirement: Denunciar

Un usuario SHALL poder denunciar a otro usuario, una vivienda o un mensaje de un
chat en el que participa, indicando un motivo; la denuncia de un mensaje SHALL
guardar una copia del mensaje como evidencia; el número de denuncias por usuario
SHALL estar limitado. Denunciar una vivienda `published` o `paused` SHALL
retirarla: pasa a `in_review`, deja de aparecer en el descubrimiento y entra en
la cola de moderación. La denuncia, la retirada y su entrada de auditoría (con
quien denuncia como actor) SHALL guardarse en la misma transacción. Los matches
abiertos de la vivienda MUST NOT cerrarse por la retirada.

#### Scenario: Denunciar una vivienda
- **GIVEN** una tarjeta de vivienda publicada
- **WHEN** el usuario la denuncia con el motivo «Anuncio falso»
- **THEN** la API responde 201, la vivienda pasa a `in_review` y deja de aparecer en el descubrimiento, y la app confirma que se ha retirado mientras el equipo la revisa

#### Scenario: La retirada queda auditada
- **GIVEN** una vivienda publicada
- **WHEN** un usuario la denuncia
- **THEN** existe una entrada de auditoría con quien denuncia, la acción «retirar por denuncia», la vivienda y la fecha

#### Scenario: Denunciar una vivienda pausada
- **GIVEN** una vivienda pausada con la que tengo un match abierto
- **WHEN** la denuncio
- **THEN** pasa a `in_review` y el match sigue abierto

#### Scenario: El propietario ve la retirada
- **GIVEN** una vivienda retirada por denuncia
- **WHEN** su propietario abre «Mis casas»
- **THEN** la ve «En revisión» con una nota que explica que no aparece en Explorar mientras se revisa

#### Scenario: Denunciar un mensaje
- **GIVEN** un mensaje ofensivo en un chat en el que participo
- **WHEN** lo denuncio
- **THEN** la denuncia guarda el texto del mensaje, su remitente y su fecha

#### Scenario: Mensaje de un chat ajeno
- **GIVEN** un mensaje de un chat en el que no participo
- **WHEN** intento denunciarlo
- **THEN** la API responde 404

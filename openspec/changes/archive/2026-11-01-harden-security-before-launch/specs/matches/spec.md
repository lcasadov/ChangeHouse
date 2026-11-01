# Spec Delta

## MODIFIED Requirements

### Requirement: Detalle del match para sus participantes

Los participantes de un match (y un `admin`) SHALL ver su detalle: las viviendas
con todas sus fotos, el nombre visible de cada participante y la compensación de
cada uno con el aviso de estimación orientativa. La dirección postal exacta de
cada vivienda que se entrega SHALL mostrarse solo mientras el match está `open` o
`confirmed` y a quien no se ha retirado. En un match `closed` el detalle MUST NOT
incluir direcciones exactas ni teléfonos. Para cualquier otro usuario el match
MUST responder como inexistente (RN-08).

#### Scenario: Participante ve el detalle
- **GIVEN** un match abierto entre mi vivienda y otra
- **WHEN** abro su detalle
- **THEN** veo la dirección exacta de la otra vivienda, su galería completa, el nombre del otro participante y mi compensación

#### Scenario: Match cerrado sin datos de contacto
- **GIVEN** un match que se cerró porque un participante se retiró
- **WHEN** cualquiera de sus participantes abre su detalle
- **THEN** ve las viviendas, los nombres y las compensaciones, pero ninguna dirección exacta ni ningún teléfono, y un aviso de que el match está cerrado

#### Scenario: Usuario ajeno
- **GIVEN** un match en el que no participo
- **WHEN** consulto su identificador
- **THEN** la API responde 404

### Requirement: Teléfono solo con autorización

El teléfono de un participante SHALL mostrarse a los demás participantes de un
match solo después de que ese participante lo autorice en ese match, y solo
mientras el match esté `open` o `confirmed`. SHALL dejar de mostrarse si revoca la
autorización. El participante SHALL poder revocarla en cualquier estado del
match. Al cerrarse el match, la autorización de todos sus participantes SHALL
quedar revocada. Autorizar en un match que no está `open` ni `confirmed` MUST
responder 409.

#### Scenario: Sin autorización
- **GIVEN** un participante que no ha autorizado compartir su teléfono
- **WHEN** otro participante abre el match
- **THEN** no ve su teléfono

#### Scenario: Autorizar y revocar
- **GIVEN** un participante con teléfono en su perfil
- **WHEN** autoriza compartirlo y después lo revoca
- **THEN** los demás lo ven tras autorizar y dejan de verlo tras revocar

#### Scenario: Revocar en un match cerrado
- **GIVEN** un match cerrado en el que había autorizado compartir mi teléfono
- **WHEN** revoco la autorización
- **THEN** la API lo acepta y la autorización queda retirada

#### Scenario: El cierre retira la autorización
- **GIVEN** un match abierto en el que un participante autorizó su teléfono
- **WHEN** el match se cierra por una retirada, una suspensión, un bloqueo o una cuenta eliminada
- **THEN** la autorización queda retirada y nadie ve ya ese teléfono en el match

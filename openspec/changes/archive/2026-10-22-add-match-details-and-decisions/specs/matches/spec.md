# Spec Delta

## Purpose

Ciclo de vida de un match: qué ven sus participantes, cómo comparten el
contacto y cómo deciden seguir adelante o retirarse.

## ADDED Requirements

### Requirement: Detalle del match para sus participantes

Los participantes de un match (y un `admin`) SHALL ver su detalle: las viviendas
con todas sus fotos, la dirección postal exacta de cada vivienda que se entrega,
el nombre visible de cada participante y la compensación de cada uno con el aviso
de estimación orientativa; para cualquier otro usuario el match MUST responder
como inexistente (RN-08).

#### Scenario: Participante ve el detalle
- **GIVEN** un match entre mi vivienda y otra
- **WHEN** abro su detalle
- **THEN** veo la dirección exacta de la otra vivienda, su galería completa, el nombre del otro participante y mi compensación

#### Scenario: Usuario ajeno
- **GIVEN** un match en el que no participo
- **WHEN** consulto su identificador
- **THEN** la API responde 404

### Requirement: Teléfono solo con autorización

El teléfono de un participante SHALL mostrarse a los demás participantes de un
match solo después de que ese participante lo autorice en ese match, y SHALL
dejar de mostrarse si revoca la autorización.

#### Scenario: Sin autorización
- **GIVEN** un participante que no ha autorizado compartir su teléfono
- **WHEN** otro participante abre el match
- **THEN** no ve su teléfono

#### Scenario: Autorizar y revocar
- **GIVEN** un participante con teléfono en su perfil
- **WHEN** autoriza compartirlo y después lo revoca
- **THEN** los demás lo ven tras autorizar y dejan de verlo tras revocar

### Requirement: Confirmar interés

Un participante en estado `pending` de un match `open` SHALL poder confirmar su
interés; cuando todos los participantes han confirmado, el match SHALL pasar a
`confirmed`; confirmar en un match que no está `open` MUST responder 409.

#### Scenario: Primera confirmación
- **GIVEN** un match directo `open` sin confirmaciones
- **WHEN** un participante confirma
- **THEN** su estado pasa a `confirmed` y el match sigue `open`

#### Scenario: Todos confirman
- **GIVEN** un match directo en el que el otro participante ya confirmó
- **WHEN** confirmo
- **THEN** el match pasa a `confirmed`

#### Scenario: Match cerrado
- **GIVEN** un match `closed`
- **WHEN** un participante intenta confirmar
- **THEN** la API responde 409

### Requirement: Retirarse cierra el match para todos

Un participante de un match `open` o `confirmed` SHALL poder retirarse tras
confirmarlo; el match SHALL pasar a `closed` para todos los participantes y su
retirada SHALL quedar registrada (RN-10).

#### Scenario: Retirarse
- **GIVEN** un match `open`
- **WHEN** un participante se retira y confirma la acción
- **THEN** el match pasa a `closed`, su estado de participante a `withdrawn` y los demás lo ven cerrado

#### Scenario: Confirmación de la retirada
- **GIVEN** un participante que pulsa «Retirarme»
- **WHEN** aparece la confirmación
- **THEN** el texto explica que el match se cerrará para todos los participantes

# Spec Delta

## ADDED Requirements

### Requirement: Publicación al enviar

El propietario SHALL poder enviar una vivienda en `draft` cuando sus datos
obligatorios están completos y tiene al menos 3 fotos procesadas, y la vivienda
SHALL pasar directamente a `published`, sin esperar a un administrador. Una
vivienda rechazada antes por un administrador (con motivo de rechazo) SHALL
pasar a `in_review` al reenviarse. Una vivienda incompleta MUST NOT poder
enviarse y la API SHALL indicar qué falta.

#### Scenario: Envío de una ficha completa
- **GIVEN** una vivienda en `draft`, nunca rechazada, con todos los datos obligatorios y 3 fotos procesadas
- **WHEN** el propietario la publica
- **THEN** pasa a `published` con su fecha de publicación, aparece en el descubrimiento y «Mis casas» muestra «Publicada»

#### Scenario: Reenvío de una vivienda rechazada
- **GIVEN** una vivienda en `draft` que un administrador rechazó con el motivo «Las fotos no corresponden a la vivienda», ya corregida
- **WHEN** el propietario la reenvía
- **THEN** pasa a `in_review` y entra en la cola de moderación

#### Scenario: Envío de una ficha incompleta
- **GIVEN** una vivienda en `draft` sin rango de valor
- **WHEN** el propietario intenta publicarla
- **THEN** la API responde 422 indicando los campos que faltan y sigue en `draft`

#### Scenario: Envío con menos de 3 fotos
- **GIVEN** una vivienda en `draft` completa con 2 fotos
- **WHEN** el propietario intenta publicarla
- **THEN** la API responde 422 indicando que faltan fotos y sigue en `draft`

#### Scenario: Edición de una vivienda en operación
- **GIVEN** una vivienda en `in_operation` o `closed`
- **WHEN** su propietario intenta modificarla
- **THEN** la API responde 409 y no cambia nada

### Requirement: Cambios relevantes sin nueva revisión

Editar el valor, las fotos, las características o el régimen de protección de
una vivienda publicada o pausada MUST NOT cambiar su estado: SHALL seguir
publicada o pausada y SHALL actualizar la fecha de cambio relevante. La app
MUST NOT avisar de que la vivienda volverá a revisión.

#### Scenario: Cambiar el valor de una vivienda publicada
- **GIVEN** una vivienda publicada
- **WHEN** su propietario cambia su rango de valor
- **THEN** sigue publicada, se actualiza su fecha de cambio relevante y la app guarda sin pedir confirmación de revisión

#### Scenario: Añadir una foto a una vivienda pausada
- **GIVEN** una vivienda pausada
- **WHEN** su propietario añade una foto
- **THEN** sigue pausada y la pantalla de fotos no muestra ningún aviso de revisión

## REMOVED Requirements

### Requirement: Envío a revisión
**Reason**: La publicación ya no espera a un administrador; la sustituye «Publicación al enviar».
**Migration**: El mismo `POST /homes/{id}/submit` devuelve ahora la vivienda en `published` (o en `in_review` si se rechazó antes).

### Requirement: Vuelta a revisión tras cambios relevantes
**Reason**: La revisión solo ocurre bajo denuncia; la sustituye «Cambios relevantes sin nueva revisión».
**Migration**: Las viviendas que ya estén en `in_review` siguen en la cola hasta que un administrador las modere.

# Spec Delta

## ADDED Requirements

### Requirement: Me gusta desde una vivienda propia

Un usuario con al menos una vivienda publicada SHALL poder marcar «Me gusta» en
una vivienda publicada ajena desde una de sus viviendas publicadas; el sistema
SHALL registrar la arista desde su vivienda hacia la otra; MUST NOT admitirse
desde una vivienda ajena o no publicada, ni hacia su propia vivienda, ni de un
usuario sin vivienda publicada (RN-01, RN-02).

#### Scenario: Me gusta válido
- **GIVEN** un propietario con su vivienda publicada viendo una vivienda compatible
- **WHEN** marca «Me gusta»
- **THEN** la API responde 201 y la vivienda deja de aparecer en sus tarjetas

#### Scenario: Usuario sin vivienda publicada
- **GIVEN** un usuario `seeker`
- **WHEN** intenta marcar «Me gusta»
- **THEN** la API responde 403 y la app le invita a publicar su vivienda

#### Scenario: Desde una vivienda que no es suya o no está publicada
- **GIVEN** un `fromHomeId` de otro usuario o de una vivienda propia en borrador
- **WHEN** se envía el me gusta
- **THEN** la API responde 404 si es ajena y 409 si es propia no publicada

#### Scenario: Me gusta repetido
- **GIVEN** un me gusta ya registrado entre las mismas viviendas
- **WHEN** se repite
- **THEN** la API responde 409 y sigue habiendo una sola arista

### Requirement: Límite diario de me gusta

El sistema SHALL limitar a 10 los «Me gusta» por usuario y día natural (hora de
Madrid), sumando todas sus viviendas, con el valor configurable por entorno; al
superarlo SHALL responder 429 con `Retry-After` hasta la medianoche.

#### Scenario: Undécimo me gusta del día
- **GIVEN** un usuario que hoy ya ha dado 10 me gusta
- **WHEN** da otro
- **THEN** la API responde 429 con `Retry-After` y la app le dice cuándo podrá seguir

### Requirement: Descartar

Un usuario SHALL poder descartar una vivienda; desde esa vivienda propia (o
desde su cuenta si es `seeker`) dejará de verla hasta que cambie su valor o sus
fotos.

#### Scenario: Descartar
- **GIVEN** una tarjeta en pantalla
- **WHEN** el usuario la descarta
- **THEN** desaparece y no vuelve en sus tarjetas mientras la vivienda no cambie

### Requirement: Deshacer la última acción

Un usuario SHALL poder deshacer su último «Me gusta» o descarte desde la misma
vivienda, salvo que el «Me gusta» haya formado ya un match; al deshacer, la
vivienda vuelve a la pila.

#### Scenario: Deshacer un descarte
- **GIVEN** un descarte recién hecho
- **WHEN** el usuario pulsa «Deshacer» en los 5 segundos siguientes
- **THEN** la tarjeta vuelve a la pila y el descarte deja de existir

#### Scenario: No se deshace un match
- **GIVEN** un me gusta que ya ha formado un match
- **WHEN** se intenta deshacer
- **THEN** la API responde 409 y el match se mantiene

### Requirement: Decidir con un gesto

En «Explorar», deslizar la tarjeta a la derecha SHALL equivaler a «Me gusta» y a
la izquierda a «Descartar»; ambas acciones SHALL estar también disponibles como
botones grandes siempre visibles y accesibles por teclado y lector de pantalla;
cada decisión SHALL confirmarse con háptica y animación que respeta «reducir
movimiento».

#### Scenario: Deslizar a la derecha
- **GIVEN** una tarjeta en pantalla
- **WHEN** el usuario la desliza a la derecha más allá del umbral
- **THEN** se registra «Me gusta» y aparece la siguiente tarjeta

#### Scenario: Sin gestos
- **GIVEN** un usuario de lector de pantalla
- **WHEN** activa el botón «Me gusta» de la tarjeta
- **THEN** se registra la acción y se anuncia el resultado

#### Scenario: Reducir movimiento
- **GIVEN** «reducir movimiento» activado en el sistema
- **WHEN** el usuario decide sobre una tarjeta
- **THEN** la tarjeta se sustituye con un fundido, sin animación de vuelo

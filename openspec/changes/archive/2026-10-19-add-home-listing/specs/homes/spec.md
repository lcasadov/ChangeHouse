# Spec Delta

## Purpose

Fichas de las viviendas que los usuarios ofrecen en permuta: qué datos tienen,
cómo se crean y editan, quién puede ver qué y por qué estados pasan.

## ADDED Requirements

### Requirement: Alta de vivienda en borrador

Un usuario particular SHALL poder dar de alta una vivienda con tipo, dirección,
superficies útil y construida, dormitorios, baños, planta, ascensor, garaje,
trastero, características, certificado energético, año, rango de valor, hipoteca
pendiente y si es su vivienda habitual; la vivienda SHALL nacer en estado
`draft` y el avance SHALL guardarse en cada paso; el rango de valor MUST cumplir
mínimo > 0 y mínimo ≤ máximo.

#### Scenario: Asistente que guarda el avance
- **GIVEN** un usuario que empieza el alta y completa el primer paso
- **WHEN** cierra la app y vuelve a «Mis casas»
- **THEN** encuentra la vivienda en borrador con los datos del primer paso y puede continuar donde lo dejó

#### Scenario: Rango de valor incoherente
- **GIVEN** el paso de valor
- **WHEN** el usuario indica un mínimo mayor que el máximo
- **THEN** ve el error junto al campo y el paso no se guarda

#### Scenario: Cuentas de gestoría o administración
- **GIVEN** un usuario con rol asignado `agency` o `admin`
- **WHEN** intenta crear una vivienda
- **THEN** la API responde 403

### Requirement: Varias viviendas por usuario

Un usuario SHALL poder tener varias viviendas, cada una con su propio estado, y
SHALL verlas todas en la pestaña «Mis casas».

#### Scenario: Segunda vivienda
- **GIVEN** un usuario con una vivienda publicada
- **WHEN** da de alta otra vivienda
- **THEN** «Mis casas» muestra las dos, cada una con su estado

#### Scenario: Sin viviendas
- **GIVEN** un usuario sin viviendas
- **WHEN** abre «Mis casas»
- **THEN** ve un estado vacío que explica que sin vivienda publicada no hay matches y un botón para publicar la primera

### Requirement: Ubicación y dirección privada

El sistema SHALL obtener del autocompletado de direcciones el punto exacto y el
barrio o zona de la vivienda; el propietario SHALL elegir si su ubicación
exacta es pública o solo el barrio o zona (por defecto, barrio o zona); la
dirección postal MUST guardarse cifrada y MUST NOT aparecer en ninguna respuesta
para terceros fuera de un match.

#### Scenario: Ubicación por zona por defecto
- **GIVEN** un propietario que no cambia la visibilidad de la ubicación
- **WHEN** otro usuario ve su vivienda publicada
- **THEN** ve el nombre del barrio o zona y un punto en su centro, nunca el punto exacto ni la dirección

#### Scenario: Ubicación exacta elegida
- **GIVEN** un propietario que elige mostrar la ubicación exacta
- **WHEN** otro usuario ve su vivienda publicada
- **THEN** ve el punto exacto en el mapa, pero no la dirección postal

#### Scenario: Dirección no reconocida
- **GIVEN** el paso de dirección
- **WHEN** el usuario elige una dirección que el servicio de direcciones no puede resolver
- **THEN** ve un mensaje que le pide elegir otra sugerencia y la vivienda no se guarda con datos incompletos

### Requirement: Detalle de vivienda según quién la consulta

El propietario SHALL ver la ficha completa de sus viviendas en cualquier estado;
cualquier otro usuario SHALL ver solo viviendas publicadas y en su forma pública;
una vivienda ajena no publicada MUST responder como inexistente (404).

#### Scenario: El propietario ve su borrador
- **GIVEN** un propietario con una vivienda en `draft`
- **WHEN** abre su detalle
- **THEN** ve todos sus datos, incluida la dirección

#### Scenario: Vivienda ajena no publicada
- **GIVEN** una vivienda en `draft` de otro usuario
- **WHEN** un usuario la consulta por su identificador
- **THEN** la API responde 404, igual que si no existiera

### Requirement: Envío a revisión

El propietario SHALL poder enviar a revisión una vivienda en `draft` cuando sus
datos obligatorios están completos, pasando a `in_review`; una vivienda
incompleta MUST NOT poder enviarse y la API SHALL indicar qué falta.

#### Scenario: Envío de una ficha completa
- **GIVEN** una vivienda en `draft` con todos los datos obligatorios
- **WHEN** el propietario la envía a revisión
- **THEN** pasa a `in_review` y «Mis casas» muestra «En revisión»

#### Scenario: Envío de una ficha incompleta
- **GIVEN** una vivienda en `draft` sin rango de valor
- **WHEN** el propietario intenta enviarla
- **THEN** la API responde 422 indicando los campos que faltan y sigue en `draft`

#### Scenario: Edición de una vivienda en operación
- **GIVEN** una vivienda en `in_operation` o `closed`
- **WHEN** su propietario intenta modificarla
- **THEN** la API responde 409 y no cambia nada

### Requirement: Rol de propietario derivado de sus viviendas

El sistema SHALL considerar `owner` al usuario con al menos una vivienda en
`published`, `paused` o `in_operation`, y `seeker` en otro caso, sin que nadie
le asigne el rol.

#### Scenario: Sin vivienda publicada
- **GIVEN** un usuario con una única vivienda en `in_review`
- **WHEN** consulta su cuenta
- **THEN** su rol es `seeker` y `hasPublishedHome` es falso

# matching Specification

## Purpose
Detección de matches: cuándo varias viviendas forman un ciclo de interés
recíproco y económicamente compatible, y qué compensación corresponde a cada
participante.

## Requirements

### Requirement: Match directo

Al registrar un «Me gusta» de la vivienda A a la vivienda B, el sistema SHALL
crear un match directo si B ya tenía un «Me gusta» hacia A, ambas viviendas
siguen publicadas y la compensación es aceptable para los dos propietarios con
sus preferencias efectivas (RN-03); la creación SHALL ocurrir en la misma
transacción que el «Me gusta» y la respuesta SHALL incluir el match.

#### Scenario: Me gusta recíproco compatible
- **GIVEN** la vivienda B ya dio «Me gusta» a la vivienda A y la diferencia de valor es aceptable para ambos
- **WHEN** el dueño de A da «Me gusta» a B
- **THEN** la respuesta incluye un match directo con A y B, en estado `open`

#### Scenario: Me gusta recíproco incompatible
- **GIVEN** la vivienda B ya dio «Me gusta» a A, pero el dueño de A no puede pagar la diferencia
- **WHEN** el dueño de A da «Me gusta» a B
- **THEN** se registra el me gusta y no se crea ningún match

#### Scenario: Vivienda ya no publicada
- **GIVEN** la vivienda B dio «Me gusta» a A y después se pausó
- **WHEN** el dueño de A da «Me gusta» a B
- **THEN** no se crea ningún match

### Requirement: Un solo match por ciclo

El sistema MUST NOT crear dos matches para el mismo conjunto de viviendas,
tampoco cuando los dos «Me gusta» que cierran el ciclo llegan a la vez; la
segunda creación SHALL tratarse como «ya existe» y no como un error.

#### Scenario: Me gusta simultáneos
- **GIVEN** las viviendas A y B sin me gusta entre ellas
- **WHEN** sus dueños se dan «Me gusta» a la vez
- **THEN** existe exactamente un match entre A y B y ninguna de las dos peticiones falla

### Requirement: Compensaciones del match

Cada participante de un match SHALL tener guardada su compensación estimada
(positiva si paga, negativa si recibe), calculada con el valor de referencia de
cada vivienda; la suma de las compensaciones de un match MUST ser 0 (RN-04).

#### Scenario: Suma cero
- **GIVEN** cualquier match creado
- **WHEN** se suman las compensaciones de sus participantes
- **THEN** el resultado es 0

#### Scenario: Compensación de cada uno
- **GIVEN** A vale 200.000 € y B vale 212.000 €
- **WHEN** se crea su match
- **THEN** el dueño de A tiene compensación +12.000 € (paga) y el de B −12.000 € (recibe)

### Requirement: Lista de matches

Un usuario SHALL ver en la pestaña «Matches» los matches en los que participa
alguna de sus viviendas, del más reciente al más antiguo, con las viviendas
implicadas, su compensación y el estado; MUST NOT ver matches ajenos.

#### Scenario: Ver mis matches
- **GIVEN** un usuario con dos matches
- **WHEN** abre «Matches»
- **THEN** ve los dos, el más reciente primero, cada uno con su compensación

#### Scenario: Sin matches
- **GIVEN** un usuario sin matches
- **WHEN** abre «Matches»
- **THEN** ve un estado vacío que le anima a seguir explorando

### Requirement: Celebración del match

Cuando un «Me gusta» crea un match, la app SHALL mostrar una celebración de
pantalla completa con las viviendas intercambiándose y un botón para ver el
match, respetando «reducir movimiento» y anunciándolo a los lectores de
pantalla.

#### Scenario: Match al dar me gusta
- **GIVEN** un me gusta que crea un match
- **WHEN** responde la API
- **THEN** aparece la celebración con el botón «Ver match» y se anuncia «¡Tenéis un match!»

### Requirement: Match en cadena de tres

Al registrar un «Me gusta» de X a Y, si no se forma un match directo
aceptable, el sistema SHALL crear un match en cadena con una vivienda Z
distinta de X e Y tal que Y tiene «Me gusta» hacia Z y Z hacia X, las tres
viviendas están publicadas, pertenecen a tres propietarios distintos y la
compensación de cada participante es aceptable con sus preferencias efectivas;
cada «Me gusta» SHALL crear como mucho un match, y MUST NOT formar ciclos de
más de tres viviendas (RN-05) ni duplicar un ciclo ya existente.

#### Scenario: Cadena compatible
- **GIVEN** B tiene «Me gusta» a C, C tiene «Me gusta» a A y las compensaciones son aceptables para los tres
- **WHEN** el dueño de A da «Me gusta» a B
- **THEN** se crea un match en cadena con A, B y C, cuya suma de compensaciones es 0

#### Scenario: Un eslabón incompatible
- **GIVEN** la misma cadena, pero el dueño de C no acepta recibir tan poco
- **WHEN** el dueño de A da «Me gusta» a B
- **THEN** no se crea el match en cadena

#### Scenario: Nunca más de tres
- **GIVEN** un grafo de «Me gusta» que solo forma un ciclo de cuatro viviendas
- **WHEN** se registra el «Me gusta» que lo cierra
- **THEN** no se crea ningún match

#### Scenario: Directo y en cadena a la vez
- **GIVEN** un «Me gusta» que cierra a la vez un ciclo de dos aceptable y uno de tres
- **WHEN** se registra
- **THEN** se crea solo el match directo, una sola vez, y la cadena no se crea con ese «Me gusta»

### Requirement: Rendimiento de la detección

La detección de matches tras un «Me gusta» SHALL completarse en menos de 1 s con
50.000 viviendas publicadas y una densidad de «Me gusta» representativa
(RNF-20).

#### Scenario: Volumen objetivo
- **GIVEN** 50.000 viviendas publicadas y 500.000 «Me gusta» sintéticos
- **WHEN** se registra un «Me gusta» que cierra ciclos
- **THEN** la detección termina en menos de 1 s en el entorno de integración

### Requirement: Presentación de la cadena

La celebración, la lista de matches y el detalle SHALL mostrar las tres
viviendas de un match en cadena y quién entrega a quién, con la compensación de
cada participante.

#### Scenario: Celebración en triángulo
- **GIVEN** un «Me gusta» que crea un match en cadena
- **WHEN** responde la API
- **THEN** la celebración muestra tres casas en triángulo y explica «A tu casa le llega la de B, la tuya va a C»

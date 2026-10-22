# Spec Delta

## ADDED Requirements

### Requirement: Match en cadena de tres

Al registrar un «Me gusta» de X a Y, el sistema SHALL crear un match en cadena
por cada vivienda Z distinta de X e Y tal que Y tiene «Me gusta» hacia Z y Z
hacia X, las tres viviendas están publicadas y la compensación de cada
participante es aceptable con sus preferencias efectivas; MUST NOT formar
ciclos de más de tres viviendas (RN-05) ni duplicar un ciclo ya existente.

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
- **GIVEN** un «Me gusta» que cierra a la vez un ciclo de dos y uno de tres
- **WHEN** se registra
- **THEN** se crean los dos matches, cada uno una sola vez

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

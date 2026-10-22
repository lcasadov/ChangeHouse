# Spec Delta

## ADDED Requirements

### Requirement: Pausar y reactivar

El propietario SHALL poder pausar una vivienda publicada y reactivar una pausada;
mientras está pausada MUST NOT aparecer en el descubrimiento ni formar matches
nuevos, y SHALL conservar sus matches abiertos; pausar algo que no está publicado
o reactivar algo que no está pausado MUST responder 409.

#### Scenario: Pausar
- **GIVEN** una vivienda publicada con un match abierto
- **WHEN** su propietario la pausa
- **THEN** deja de aparecer en el descubrimiento, el match sigue abierto y «Mis casas» muestra «Pausada»

#### Scenario: Reactivar
- **GIVEN** una vivienda pausada
- **WHEN** su propietario la reactiva
- **THEN** vuelve a `published` y a aparecer en el descubrimiento

#### Scenario: Pausar un borrador
- **GIVEN** una vivienda en `draft`
- **WHEN** su propietario intenta pausarla
- **THEN** la API responde 409

### Requirement: Vuelta a revisión tras cambios relevantes

Editar el valor, las fotos o las características de una vivienda publicada o
pausada SHALL devolverla a `in_review` y actualizar la fecha de cambio relevante;
editar solo la visibilidad de la ubicación MUST NOT hacerlo.

#### Scenario: Cambiar el valor de una vivienda publicada
- **GIVEN** una vivienda publicada
- **WHEN** su propietario cambia su rango de valor
- **THEN** pasa a `in_review` y la app avisa antes de guardar de que volverá a revisión

#### Scenario: Cambiar solo la visibilidad de la ubicación
- **GIVEN** una vivienda publicada
- **WHEN** su propietario cambia de «zona» a «ubicación exacta»
- **THEN** sigue publicada

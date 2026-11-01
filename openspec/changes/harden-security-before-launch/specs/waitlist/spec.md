# Spec Delta

## ADDED Requirements

### Requirement: Retención de la lista de espera

Las inscripciones de la lista de espera SHALL borrarse cuando hayan pasado 12
meses desde la fecha de lanzamiento configurada. Cada purga SHALL quedar
registrada en la auditoría con el número de inscripciones borradas. Sin fecha de
lanzamiento configurada, la purga MUST NOT borrar nada.

#### Scenario: Purga tras el plazo
- **GIVEN** una fecha de lanzamiento de hace 13 meses e inscripciones en la lista
- **WHEN** se ejecuta la purga programada
- **THEN** las inscripciones se borran y la auditoría registra cuántas

#### Scenario: Sin fecha de lanzamiento
- **GIVEN** que no hay fecha de lanzamiento configurada
- **WHEN** se ejecuta la purga programada
- **THEN** no se borra ninguna inscripción

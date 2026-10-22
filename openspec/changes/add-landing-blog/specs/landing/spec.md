# Spec Delta

## ADDED Requirements

### Requirement: Guías publicadas

La landing SHALL publicar un listado de guías en `/guias`, de la más reciente a
la más antigua, y cada guía SHALL mostrarse con título, fecha, tiempo de lectura,
índice de secciones y una llamada a la lista de espera; ningún artículo MUST
recomendar valores de escritura ni hablar de «ahorro fiscal» (RN-07).

#### Scenario: Listado de guías
- **GIVEN** tres guías publicadas
- **WHEN** un visitante abre `/guias`
- **THEN** ve las tres, la más reciente primero, con su título, fecha y resumen

#### Scenario: Artículo
- **GIVEN** una guía publicada
- **WHEN** el visitante la abre
- **THEN** ve el índice de secciones, el tiempo de lectura y, al final, el acceso a la lista de espera

#### Scenario: Borradores fuera
- **GIVEN** una guía marcada como borrador
- **WHEN** se construye el sitio de producción
- **THEN** no aparece en el listado ni tiene página

### Requirement: Guías encontrables

Cada guía SHALL declarar título, descripción, imagen y datos estructurados de
artículo, SHALL figurar en el mapa del sitio, y el blog SHALL ofrecer un feed RSS.

#### Scenario: Datos estructurados
- **GIVEN** una guía publicada
- **WHEN** un buscador lee su página
- **THEN** encuentra datos estructurados de tipo artículo con su título y fecha

#### Scenario: Feed
- **GIVEN** el sitio construido
- **WHEN** se solicita `/guias/rss.xml`
- **THEN** contiene las guías publicadas

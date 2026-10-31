# Spec Delta

## ADDED Requirements

### Requirement: Límites de las subidas de fotos

Cada fichero subido como foto de una vivienda MUST NOT superar 25 MB, y el
almacenamiento SHALL rechazar la subida si lo supera. Una vivienda MUST NOT tener
más de 25 fotos pendientes de confirmar a la vez. Una imagen de más de 40
megapíxeles MUST rechazarse al confirmar la foto con un error de validación, sin
llegar a procesarse.

#### Scenario: Fichero demasiado grande
- **GIVEN** una URL de subida de una foto
- **WHEN** se sube por ella un fichero de 30 MB
- **THEN** el almacenamiento rechaza la subida

#### Scenario: Demasiadas fotos pendientes
- **GIVEN** una vivienda con 25 fotos pendientes de confirmar
- **WHEN** su propietario pide otra URL de subida
- **THEN** la API responde 409 y no crea la foto

#### Scenario: Imagen con demasiados píxeles
- **GIVEN** una foto subida de 10.000 × 10.000 píxeles
- **WHEN** el propietario confirma la subida
- **THEN** la API la rechaza con un error de validación y la foto no se publica

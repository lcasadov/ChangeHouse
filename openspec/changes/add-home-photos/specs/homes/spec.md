# Spec Delta

## ADDED Requirements

### Requirement: Fotos de la vivienda

El propietario SHALL poder subir hasta 20 fotos por vivienda en formato JPEG,
PNG, HEIC o WebP y eliminarlas; una foto solo SHALL ser visible cuando su subida
se ha confirmado y procesado; una vivienda publicada MUST NOT quedarse con
menos de 3 fotos.

#### Scenario: Subir una foto
- **GIVEN** un propietario con una vivienda en borrador
- **WHEN** elige una foto de su galería
- **THEN** ve el progreso de la subida y, al terminar, la foto aparece en su vivienda

#### Scenario: Límite de 20 fotos
- **GIVEN** una vivienda con 20 fotos
- **WHEN** el propietario intenta añadir otra
- **THEN** la API responde 409 y la app le explica el límite

#### Scenario: Borrar por debajo del mínimo en una vivienda publicada
- **GIVEN** una vivienda publicada con 3 fotos
- **WHEN** el propietario intenta borrar una
- **THEN** la API responde 409 y la foto se mantiene

#### Scenario: Subida sin confirmar
- **GIVEN** una URL de subida emitida cuya subida nunca se confirma
- **WHEN** cualquier usuario consulta la vivienda
- **THEN** esa foto no aparece

### Requirement: Fotos sin metadatos de ubicación

Toda foto visible SHALL haberse procesado en el servidor: sin ningún metadato
EXIF (en particular sin coordenadas GPS), comprimida y con un lado mayor de
como máximo 2048 px.

#### Scenario: Foto con coordenadas GPS
- **GIVEN** una foto subida que contiene coordenadas GPS en sus metadatos
- **WHEN** se confirma la subida y se procesa
- **THEN** la imagen publicada no contiene metadatos EXIF y su lado mayor no supera 2048 px

#### Scenario: Fichero que no es una imagen
- **GIVEN** un fichero subido que no es una imagen válida
- **WHEN** se confirma la subida
- **THEN** la API responde 422, la foto no se publica y el fichero se elimina

## MODIFIED Requirements

### Requirement: Envío a revisión

El propietario SHALL poder enviar a revisión una vivienda en `draft` cuando sus
datos obligatorios están completos y tiene al menos 3 fotos procesadas,
pasando a `in_review`; una vivienda incompleta MUST NOT poder enviarse y la API
SHALL indicar qué falta.

#### Scenario: Envío de una ficha completa
- **GIVEN** una vivienda en `draft` con todos los datos obligatorios y 3 fotos procesadas
- **WHEN** el propietario la envía a revisión
- **THEN** pasa a `in_review` y «Mis casas» muestra «En revisión»

#### Scenario: Envío de una ficha incompleta
- **GIVEN** una vivienda en `draft` sin rango de valor
- **WHEN** el propietario intenta enviarla
- **THEN** la API responde 422 indicando los campos que faltan y sigue en `draft`

#### Scenario: Envío con menos de 3 fotos
- **GIVEN** una vivienda en `draft` completa con 2 fotos
- **WHEN** el propietario intenta enviarla
- **THEN** la API responde 422 indicando que faltan fotos y sigue en `draft`

#### Scenario: Edición de una vivienda en operación
- **GIVEN** una vivienda en `in_operation` o `closed`
- **WHEN** su propietario intenta modificarla
- **THEN** la API responde 409 y no cambia nada

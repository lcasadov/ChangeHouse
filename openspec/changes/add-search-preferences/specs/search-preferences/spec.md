# Spec Delta

## Purpose

Lo que busca cada usuario —zonas, características y compensación aceptable—,
con la posibilidad de afinarlo para cada una de sus viviendas.

## ADDED Requirements

### Requirement: Preferencias por defecto del usuario

Un usuario SHALL poder guardar y consultar sus preferencias por defecto: zonas
(municipios o un punto con radio de hasta 200 km), filtros, máximo a pagar,
mínimo a recibir y el punto de referencia de su rango de valor (0–100, por
defecto 50); sin al menos una zona y los dos importes de compensación MUST NOT
guardarse.

#### Scenario: Guardar preferencias
- **GIVEN** un usuario sin preferencias
- **WHEN** guarda «Getafe» como zona, 3 dormitorios mínimo, pagar hasta 30.000 € y recibir al menos 0 €
- **THEN** al consultarlas obtiene esos valores y el punto de referencia 50

#### Scenario: Sin zona
- **GIVEN** un usuario guardando preferencias
- **WHEN** no indica ningún municipio ni punto con radio
- **THEN** la API responde 422 y la app pide elegir una zona

#### Scenario: Punto de referencia fuera de rango
- **GIVEN** un usuario guardando preferencias
- **WHEN** envía un punto de referencia de 120
- **THEN** la API responde 400 señalando el campo

### Requirement: Preferencias propias de una vivienda

El propietario SHALL poder definir preferencias propias para cualquiera de sus
viviendas, que sustituyen por completo a las del usuario al buscar y emparejar
desde esa vivienda, y SHALL poder eliminarlas para volver a las del usuario.

#### Scenario: Preferencias distintas para una segunda vivienda
- **GIVEN** un propietario con preferencias por defecto en Madrid y una segunda vivienda en la costa
- **WHEN** define para la segunda vivienda preferencias en Valencia
- **THEN** buscar desde la segunda vivienda usa Valencia y buscar desde la primera sigue usando Madrid

#### Scenario: Volver a las del usuario
- **GIVEN** una vivienda con preferencias propias
- **WHEN** el propietario las elimina
- **THEN** consultar las preferencias de la vivienda responde 404 y la búsqueda desde ella usa las del usuario

#### Scenario: Vivienda ajena
- **GIVEN** una vivienda de otro usuario
- **WHEN** alguien intenta leer o cambiar sus preferencias
- **THEN** la API responde 404

### Requirement: Búsqueda en un toque

La app SHALL ofrecer una barra «¿Dónde quieres vivir?» con autocompletado de
municipios y lugares, chips de filtro que se activan con un toque y una hoja
con el resto de filtros y la compensación; el primer uso SHALL pedir zona y
compensación antes de mostrar viviendas.

#### Scenario: Escribir un sitio
- **GIVEN** la barra de búsqueda en «Explorar»
- **WHEN** el usuario escribe «Alcob» y elige «Alcobendas»
- **THEN** Alcobendas queda como zona y las preferencias se guardan

#### Scenario: Activar un chip
- **GIVEN** el chip «Garaje» desactivado
- **WHEN** el usuario lo toca
- **THEN** queda activado, se anuncia su estado a los lectores de pantalla y se guarda el filtro

#### Scenario: Primer uso
- **GIVEN** un usuario recién dado de alta sin preferencias
- **WHEN** entra en «Explorar»
- **THEN** ve el paso «¿Dónde quieres vivir y cuánto puedes compensar?» antes de cualquier tarjeta

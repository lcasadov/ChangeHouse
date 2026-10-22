# Spec Delta

## ADDED Requirements

### Requirement: Régimen de protección

Cada vivienda SHALL declarar su régimen —libre, VPPB, VPPL o VPO—; una vivienda
protegida MUST indicar la fecha de calificación definitiva y MAY indicar el fin
del plazo de protección y el precio máximo legal.

#### Scenario: VPP sin fecha de calificación
- **GIVEN** un propietario que marca su vivienda como VPPL
- **WHEN** intenta continuar sin fecha de calificación definitiva
- **THEN** ve el error junto al campo y la API rechaza la ficha con 400 si se envía

#### Scenario: Vivienda libre
- **GIVEN** un propietario que marca «Libre»
- **WHEN** continúa
- **THEN** no se le piden datos de protección

### Requirement: Precio máximo legal

Si una vivienda protegida declara precio máximo legal, su valor máximo declarado
MUST NOT superarlo (RN-06).

#### Scenario: Valor por encima del máximo legal
- **GIVEN** una VPO con precio máximo legal de 180.000 €
- **WHEN** el propietario declara un valor máximo de 200.000 €
- **THEN** la API responde 422 indicando el límite y la app lo muestra junto al campo

### Requirement: Aviso informativo de vivienda protegida

La ficha y el detalle de una vivienda protegida SHALL mostrar un aviso con su
régimen, el precio máximo legal si se conoce, la necesidad de visado o
autorización y que el adquirente debe cumplir los requisitos de acceso, e
indicar que el derecho de tanteo y retracto en permutas está pendiente de
confirmar.

#### Scenario: Detalle de una VPPL
- **GIVEN** una VPPL publicada con precio máximo legal
- **WHEN** un usuario que cumple los requisitos abre su detalle
- **THEN** ve el aviso de vivienda protegida con el precio máximo y los requisitos

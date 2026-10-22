# discovery Specification

## Purpose
Descubrimiento de viviendas: qué se propone a cada usuario desde cada una de sus
viviendas, por qué encaja y cuánto costaría el cambio.

## Requirements

### Requirement: Viviendas compatibles en los dos sentidos

Desde una vivienda propia publicada, el descubrimiento SHALL devolver solo
viviendas publicadas que cumplen las preferencias efectivas de esa vivienda y
cuya ubicación y características cumplen las preferencias efectivas de la
vivienda candidata, y para las que la compensación es aceptable para ambos
propietarios: quien paga no supera su máximo a pagar y quien recibe obtiene al
menos su mínimo a recibir (RN-03). La respuesta SHALL paginarse por cursor.

#### Scenario: Compatibles en ambos sentidos
- **GIVEN** mi vivienda en Getafe que vale 200.000 € y busca en Leganés, y una vivienda en Leganés que vale 220.000 € cuyo dueño busca en Getafe
- **WHEN** puedo pagar hasta 30.000 € y el otro dueño acepta recibir desde 0 €
- **THEN** la vivienda de Leganés aparece en mis tarjetas

#### Scenario: Su dueño no busca en mi zona
- **GIVEN** una vivienda que cumple mis preferencias cuyo dueño solo busca en Valencia
- **WHEN** consulto mis tarjetas desde mi vivienda de Getafe
- **THEN** esa vivienda no aparece

#### Scenario: Compensación fuera de mis límites
- **GIVEN** una vivienda candidata que vale 60.000 € más que la mía
- **WHEN** mi máximo a pagar es 30.000 €
- **THEN** no aparece en mis tarjetas

#### Scenario: Paginación
- **GIVEN** más viviendas compatibles que el tamaño de página
- **WHEN** pido la página siguiente con el cursor recibido
- **THEN** recibo las siguientes sin repetir ninguna

### Requirement: Compensación visible en cada tarjeta

Cada tarjeta de una búsqueda desde una vivienda propia SHALL indicar la
compensación estimada del usuario —«Tú recibes», «Tú pagas» o «Cambio justo»—
calculada con el valor de cada vivienda en el punto de referencia del rango de
su propietario, y SHALL indicar que es una estimación orientativa.

#### Scenario: El usuario paga
- **GIVEN** mi vivienda valorada en 200.000 € y una candidata en 212.000 €
- **WHEN** veo su tarjeta
- **THEN** la píldora dice «Tú pagas 12.000 €»

#### Scenario: Cambio justo
- **GIVEN** una diferencia de valor que no supera el 1 % del mayor de los dos valores
- **WHEN** veo la tarjeta
- **THEN** la píldora dice «Cambio justo»

### Requirement: Viviendas excluidas

El descubrimiento MUST NOT mostrar las viviendas del propio usuario, las que no
están publicadas (incluidas las que están en operación), las ya descartadas
desde esa vivienda salvo que su valor o sus fotos hayan cambiado después del
descarte, ni viviendas VPP a usuarios que no declaran cumplir los requisitos de
acceso (RN-06, RN-11).

#### Scenario: Vivienda en operación
- **GIVEN** una vivienda compatible que pasa a `in_operation`
- **WHEN** consulto mis tarjetas
- **THEN** ya no aparece

#### Scenario: Descarte y cambio relevante
- **GIVEN** una vivienda que descarté y cuyo dueño después cambia su rango de valor
- **WHEN** consulto mis tarjetas
- **THEN** vuelve a aparecer

#### Scenario: VPP sin requisitos
- **GIVEN** una vivienda VPP compatible y un usuario que no declara cumplir los requisitos
- **WHEN** consulta sus tarjetas
- **THEN** la vivienda VPP no aparece

### Requirement: Descubrimiento sin vivienda publicada

Un usuario sin vivienda publicada SHALL ver las viviendas publicadas que cumplen
sus preferencias por defecto, sin filtro de compatibilidad inversa ni
compensación, y SHALL ver un aviso permanente de que sin vivienda publicada no
puede hacer match.

#### Scenario: Buscador mirando
- **GIVEN** un usuario `seeker` con preferencias en Madrid
- **WHEN** abre «Explorar»
- **THEN** ve viviendas de Madrid sin píldora de compensación y el aviso para publicar su vivienda

### Requirement: Tarjetas a pantalla completa

«Explorar» SHALL presentar las viviendas como tarjetas a pantalla completa con
carrusel de fotos, la píldora de compensación, superficie, dormitorios, baños y
zona sobre un degradado legible, y SHALL abrir el detalle al tocarla; si hay
varias viviendas propias publicadas, SHALL permitir elegir desde cuál se busca.

#### Scenario: Ver el detalle
- **GIVEN** una tarjeta en pantalla
- **WHEN** el usuario la toca
- **THEN** se abre el detalle con todas las fotos y características, sin dirección postal

#### Scenario: Elegir la vivienda desde la que se busca
- **GIVEN** un propietario con dos viviendas publicadas
- **WHEN** cambia la vivienda seleccionada en «Explorar»
- **THEN** las tarjetas y sus compensaciones se recalculan para esa vivienda

#### Scenario: Sin más viviendas
- **GIVEN** que no quedan viviendas compatibles
- **WHEN** el usuario llega al final
- **THEN** ve un estado vacío que sugiere ampliar la zona o la compensación, con acceso directo a los filtros

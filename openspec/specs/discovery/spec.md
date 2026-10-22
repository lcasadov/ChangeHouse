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

### Requirement: Me gusta desde una vivienda propia

Un usuario con al menos una vivienda publicada SHALL poder marcar «Me gusta» en
una vivienda publicada ajena desde una de sus viviendas publicadas; el sistema
SHALL registrar la arista desde su vivienda hacia la otra; MUST NOT admitirse
desde una vivienda ajena o no publicada, ni hacia su propia vivienda, ni de un
usuario sin vivienda publicada (RN-01, RN-02).

#### Scenario: Me gusta válido
- **GIVEN** un propietario con su vivienda publicada viendo una vivienda compatible
- **WHEN** marca «Me gusta»
- **THEN** la API responde 201 y la vivienda deja de aparecer en sus tarjetas

#### Scenario: Usuario sin vivienda publicada
- **GIVEN** un usuario `seeker`
- **WHEN** intenta marcar «Me gusta»
- **THEN** la API responde 403 y la app le invita a publicar su vivienda

#### Scenario: Desde una vivienda que no es suya o no está publicada
- **GIVEN** un `fromHomeId` de otro usuario o de una vivienda propia en borrador
- **WHEN** se envía el me gusta
- **THEN** la API responde 404 si es ajena y 409 si es propia no publicada

#### Scenario: Me gusta repetido
- **GIVEN** un me gusta ya registrado entre las mismas viviendas
- **WHEN** se repite
- **THEN** la API responde 409 y sigue habiendo una sola arista

### Requirement: Límite diario de me gusta

El sistema SHALL limitar a 10 los «Me gusta» por usuario y día natural (hora de
Madrid), sumando todas sus viviendas, con el valor configurable por entorno; al
superarlo SHALL responder 429 con `Retry-After` hasta la medianoche.

#### Scenario: Undécimo me gusta del día
- **GIVEN** un usuario que hoy ya ha dado 10 me gusta
- **WHEN** da otro
- **THEN** la API responde 429 con `Retry-After` y la app le dice cuándo podrá seguir

### Requirement: Descartar

Un usuario SHALL poder descartar una vivienda; desde esa vivienda propia (o
desde su cuenta si es `seeker`) dejará de verla hasta que cambie su valor o sus
fotos.

#### Scenario: Descartar
- **GIVEN** una tarjeta en pantalla
- **WHEN** el usuario la descarta
- **THEN** desaparece y no vuelve en sus tarjetas mientras la vivienda no cambie

### Requirement: Deshacer la última acción

Un usuario SHALL poder deshacer su último «Me gusta» o descarte desde la misma
vivienda, salvo que el «Me gusta» haya formado ya un match; al deshacer, la
vivienda vuelve a la pila.

#### Scenario: Deshacer un descarte
- **GIVEN** un descarte recién hecho
- **WHEN** el usuario pulsa «Deshacer» en los 5 segundos siguientes
- **THEN** la tarjeta vuelve a la pila y el descarte deja de existir

#### Scenario: No se deshace un match
- **GIVEN** un me gusta que ya ha formado un match
- **WHEN** se intenta deshacer
- **THEN** la API responde 409 y el match se mantiene

### Requirement: Decidir con un gesto

En «Explorar», deslizar la tarjeta a la derecha SHALL equivaler a «Me gusta» y a
la izquierda a «Descartar»; ambas acciones SHALL estar también disponibles como
botones grandes siempre visibles y accesibles por teclado y lector de pantalla;
cada decisión SHALL confirmarse con háptica y animación que respeta «reducir
movimiento».

#### Scenario: Deslizar a la derecha
- **GIVEN** una tarjeta en pantalla
- **WHEN** el usuario la desliza a la derecha más allá del umbral
- **THEN** se registra «Me gusta» y aparece la siguiente tarjeta

#### Scenario: Sin gestos
- **GIVEN** un usuario de lector de pantalla
- **WHEN** activa el botón «Me gusta» de la tarjeta
- **THEN** se registra la acción y se anuncia el resultado

#### Scenario: Reducir movimiento
- **GIVEN** «reducir movimiento» activado en el sistema
- **WHEN** el usuario decide sobre una tarjeta
- **THEN** la tarjeta se sustituye con un fundido, sin animación de vuelo

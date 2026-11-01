## MODIFIED Requirements

### Requirement: Tarjetas a pantalla completa

«Explorar» SHALL presentar las viviendas como tarjetas con carrusel de fotos y
SHALL mostrar sobre un degradado legible la píldora de compensación, la
superficie, los dormitorios, los baños y la zona. Cada tarjeta SHALL caber
entera en el área visible, sin desplazar la página, junto a la búsqueda y a los
filtros, que van en una sola fila desplazable en horizontal. SHALL abrir el
detalle al tocar la tarjeta y, si el usuario tiene varias viviendas propias
publicadas, SHALL permitir elegir desde cuál busca.

#### Scenario: Tarjeta entera en pantalla
- **GIVEN** una ventana de 390 × 844 o de 1280 × 720 con tarjetas disponibles
- **WHEN** se abre «Explorar»
- **THEN** la tarjeta completa, con sus datos y los botones de decisión, queda visible sin desplazar la página

#### Scenario: Filtros en una fila
- **GIVEN** la barra de filtros de «Explorar» en una pantalla estrecha
- **WHEN** los filtros no caben en el ancho
- **THEN** se mantienen en una sola fila que se desplaza en horizontal y todos siguen alcanzables con teclado

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
- **THEN** ve un estado vacío con imagen que sugiere ampliar la zona o la compensación, con acceso directo a los filtros

# landing Specification

## Purpose
Web pública de ChangeHouse: explica la propuesta de permuta de viviendas, informa
de cómo funciona y de sus condiciones legales, y respeta el consentimiento del
visitante desde la primera visita.

## Requirements

### Requirement: Presentación de la propuesta de valor

La landing SHALL mostrar en la primera pantalla, a pantalla completa y sobre un
fondo fotográfico (vídeo o imagen fija), la promesa «Cambia de casa sin vender
primero», una explicación de una frase y una llamada a la acción hacia la lista
de espera. SHALL incluir en la misma página las secciones «Cómo funciona» (tres
pasos), «Cadenas de tres», ventajas, historia del fundador y preguntas
frecuentes.

#### Scenario: Primera pantalla
- **GIVEN** un visitante que abre la página principal
- **WHEN** la página termina de cargar
- **THEN** ve el titular «Cambia de casa sin vender primero», la frase que lo explica y un botón que lleva a la sección de lista de espera, sobre el fondo fotográfico y sin desplazarse

#### Scenario: Texto legible sobre el fondo
- **GIVEN** la primera pantalla en el tema claro o en el oscuro
- **WHEN** se mide el contraste del titular, la frase y la cabecera
- **THEN** el texto blanco descansa sobre un velo que garantiza al menos 4,5:1 en cualquier fotograma del fondo

#### Scenario: Cómo funciona en tres pasos
- **GIVEN** un visitante en la página principal
- **WHEN** navega a la sección «Cómo funciona»
- **THEN** ve exactamente tres pasos: publicar tu casa, marcar las que te gustan y cerrar el cambio con una gestoría

#### Scenario: Preguntas frecuentes desplegables
- **GIVEN** la sección de preguntas frecuentes
- **WHEN** el visitante activa una pregunta con ratón, toque o teclado
- **THEN** se muestra su respuesta y el control indica su estado expandido a los lectores de pantalla

#### Scenario: Sin promesas fiscales indebidas
- **GIVEN** cualquier texto de la landing
- **WHEN** se revisa su contenido
- **THEN** no aparece ninguna referencia a «ahorro fiscal» ni a escriturar por debajo del valor de mercado (RN-07)

### Requirement: Páginas legales

La landing SHALL publicar las páginas aviso legal, política de privacidad,
política de cookies y términos de uso, y SHALL enlazarlas desde el pie de todas
las páginas.

#### Scenario: Enlaces legales en el pie
- **GIVEN** cualquier página de la landing
- **WHEN** el visitante llega al pie
- **THEN** encuentra enlaces a aviso legal, privacidad, cookies y términos que abren su página correspondiente

#### Scenario: Texto pendiente de revisión identificado
- **GIVEN** una página legal cuyo texto aún no ha validado el asesor jurídico
- **WHEN** se muestra
- **THEN** indica de forma visible que es un borrador pendiente de revisión

### Requirement: Consentimiento de cookies

La landing MUST NOT guardar cookies ni almacenamiento no esenciales, ni cargar
analítica, antes de que el visitante consienta; SHALL ofrecer aceptar, rechazar
y configurar con el mismo esfuerzo, y SHALL recordar la elección y permitir
cambiarla.

#### Scenario: Sin cookies no esenciales antes de decidir
- **GIVEN** un visitante nuevo
- **WHEN** abre la landing y todavía no ha decidido
- **THEN** no se guarda ninguna cookie ni dato no esencial y no se carga ningún script de analítica

#### Scenario: Rechazar es tan fácil como aceptar
- **GIVEN** el aviso de cookies visible
- **WHEN** el visitante lo examina
- **THEN** «Aceptar» y «Rechazar» están en el mismo nivel, con el mismo tamaño y sin pasos adicionales

#### Scenario: La elección se recuerda
- **GIVEN** un visitante que ha rechazado las cookies no esenciales
- **WHEN** vuelve a la landing
- **THEN** no se le vuelve a preguntar y sigue sin cargarse la analítica

#### Scenario: Cambiar la elección
- **GIVEN** un visitante que ya decidió
- **WHEN** usa el enlace «Configurar cookies» del pie
- **THEN** puede cambiar su elección y se aplica de inmediato

### Requirement: Accesibilidad, temas y adaptación a pantalla

La landing SHALL cumplir WCAG 2.2 AA, SHALL seguir el tema claro u oscuro del
sistema y SHALL adaptarse a pantallas desde 320 px de ancho sin desplazamiento
horizontal.

#### Scenario: Navegación con teclado
- **GIVEN** un visitante que solo usa el teclado
- **WHEN** recorre la página con Tab
- **THEN** alcanza todos los enlaces y controles en orden lógico y el foco es siempre visible

#### Scenario: Tema oscuro del sistema
- **GIVEN** un dispositivo con el tema oscuro activado
- **WHEN** se abre la landing
- **THEN** se muestra con la paleta oscura y todos los textos mantienen un contraste de al menos 4,5:1

#### Scenario: Pantalla estrecha
- **GIVEN** una ventana de 320 px de ancho
- **WHEN** se carga cualquier página
- **THEN** no aparece desplazamiento horizontal y ningún contenido queda cortado

### Requirement: Descubrimiento en buscadores

Cada página de la landing SHALL declarar título, descripción e imagen para
compartir propios, y el sitio SHALL publicar `sitemap.xml` y `robots.txt`.

#### Scenario: Metadatos por página
- **GIVEN** cualquier página publicada
- **WHEN** un buscador o una red social la lee
- **THEN** encuentra un título y una descripción propios de esa página y una imagen para compartir

#### Scenario: Mapa del sitio
- **GIVEN** el sitio construido
- **WHEN** se solicita `/sitemap-index.xml` o `/robots.txt`
- **THEN** ambos existen y el mapa incluye la página principal y las páginas legales

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

### Requirement: Vídeo de fondo del héroe

El héroe SHALL reproducir un vídeo decorativo, silencioso y en bucle. SHALL
mostrar su imagen fija mientras carga y SHALL ofrecer un control siempre visible
para pausarlo y reanudarlo. SHALL quedarse en la imagen fija, sin reproducir,
cuando el visitante pide reducir el movimiento o ahorrar datos, o cuando no se
ejecuta JavaScript.

#### Scenario: Reproducción por defecto
- **GIVEN** un visitante sin preferencia de movimiento reducido ni de ahorro de datos
- **WHEN** abre la página principal
- **THEN** el vídeo se reproduce sin sonido y en bucle, y queda oculto a los lectores de pantalla

#### Scenario: Pausar y reanudar
- **GIVEN** el vídeo en reproducción
- **WHEN** el visitante activa el control con ratón, toque o teclado
- **THEN** el vídeo se detiene, el control anuncia su estado y ofrece reanudarlo

#### Scenario: Movimiento reducido
- **GIVEN** un dispositivo con «reducir movimiento» activado
- **WHEN** se abre la página principal
- **THEN** se muestra la imagen fija, el vídeo no se reproduce y el control permite iniciarlo si el visitante lo pide

#### Scenario: Ahorro de datos
- **GIVEN** un navegador que declara ahorro de datos
- **WHEN** se abre la página principal
- **THEN** se muestra la imagen fija y no se descarga el vídeo hasta que el visitante lo inicie

### Requirement: Secciones con fotografía

«Cómo funciona» SHALL acompañar cada paso con una fotografía. «Cadenas de tres»
y la lista de espera SHALL presentarse sobre una fotografía a sangre, con el
texto y el formulario sobre un velo o una superficie que mantengan el contraste
de WCAG 2.2 AA. Toda fotografía SHALL tener texto alternativo si informa, o
quedar oculta a los lectores de pantalla si es decorativa.

#### Scenario: Pasos con foto
- **GIVEN** un visitante en «Cómo funciona»
- **WHEN** ve los tres pasos
- **THEN** cada paso muestra su fotografía con texto alternativo descriptivo

#### Scenario: Formulario legible sobre fotografía
- **GIVEN** la lista de espera en el tema claro o en el oscuro
- **WHEN** se revisa con un analizador de accesibilidad
- **THEN** no hay infracciones de contraste y el formulario sigue siendo usable con teclado

#### Scenario: Imágenes que no bloquean la carga
- **GIVEN** un visitante que abre la página principal
- **WHEN** carga la primera pantalla
- **THEN** las fotografías de las secciones inferiores se cargan de forma diferida

## MODIFIED Requirements

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

## ADDED Requirements

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

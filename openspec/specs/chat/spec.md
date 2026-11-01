# chat Specification

## Purpose
Chat de grupo de los participantes de un match: quién puede leer y escribir,
qué se puede enviar y qué ocurre cuando el match se cierra.

## Requirements

### Requirement: Chat de grupo por match

Cada match SHALL tener un chat de grupo con todos sus participantes, creado al
crearse el match y accesible desde su detalle.

#### Scenario: Chat creado con el match
- **GIVEN** un «Me gusta» que crea un match
- **WHEN** los participantes abren el match
- **THEN** encuentran su chat vacío con un mensaje del sistema que presenta a los participantes

### Requirement: Enviar mensajes

Un participante de un match no cerrado SHALL poder enviar mensajes de texto de
hasta 2.000 caracteres e imágenes, que los demás participantes reciben en tiempo
real; las imágenes SHALL publicarse sin metadatos; un mensaje vacío o demasiado
largo MUST rechazarse.

#### Scenario: Mensaje en tiempo real
- **GIVEN** dos participantes con el chat abierto
- **WHEN** uno envía «¿Te viene bien visitarla el sábado?»
- **THEN** el otro lo ve aparecer sin recargar, con el nombre del remitente y la hora

#### Scenario: Imagen
- **GIVEN** un participante en el chat
- **WHEN** envía una foto de su galería
- **THEN** los demás la ven en el chat sin metadatos de ubicación

#### Scenario: Mensaje demasiado largo
- **GIVEN** un mensaje de 2.001 caracteres
- **WHEN** se envía
- **THEN** la API responde 400 y la app indica el límite

#### Scenario: Envío fallido
- **GIVEN** que no hay conexión
- **WHEN** un participante envía un mensaje
- **THEN** el mensaje aparece como «No enviado» con la opción de reintentar

### Requirement: Solo los participantes leen el chat

Solo los participantes de un match SHALL poder leer su chat; ningún cliente MUST
poder escribir directamente en el almacén del chat: todo envío pasa por la API.

#### Scenario: Usuario ajeno
- **GIVEN** un usuario que no participa en un match
- **WHEN** intenta leer su chat directamente en el almacén
- **THEN** el acceso se deniega

#### Scenario: Escritura directa
- **GIVEN** un participante
- **WHEN** intenta escribir un mensaje directamente en el almacén sin pasar por la API
- **THEN** la escritura se deniega

### Requirement: Chat de un match cerrado

Cuando un match se cierra, su chat SHALL quedar en solo lectura para todos los
participantes, con un aviso del motivo.

#### Scenario: Match cerrado
- **GIVEN** un match en el que un participante se ha retirado
- **WHEN** otro participante abre el chat
- **THEN** ve el historial, un aviso de que el match está cerrado y no puede enviar mensajes; la API responde 409 si lo intenta

### Requirement: Límite de imágenes del chat

Cada imagen subida al chat MUST NOT superar 25 MB ni 40 megapíxeles. Un usuario
MUST NOT pedir más de 30 subidas de imágenes del chat por hora. Al superar ese
límite, la API SHALL responder 429 con la cabecera `Retry-After`.

#### Scenario: Demasiadas imágenes en una hora
- **GIVEN** un participante que ya ha pedido 30 subidas de imágenes en la última hora
- **WHEN** pide otra
- **THEN** la API responde 429 con `Retry-After` y la app explica que lo intente más tarde

### Requirement: Retención del chat

Los mensajes y las imágenes del chat de un match SHALL borrarse cuando hayan pasado
12 meses desde el cierre del match. Cada purga SHALL quedar registrada en la
auditoría con el número de chats afectados. El detalle del match SHALL seguir
disponible.

#### Scenario: Chat de un match cerrado hace más de un año
- **GIVEN** un match cerrado hace 13 meses con mensajes e imágenes
- **WHEN** se ejecuta la purga programada
- **THEN** sus mensajes e imágenes ya no existen, el detalle del match sigue disponible y la auditoría registra la purga

#### Scenario: Chat reciente
- **GIVEN** un match cerrado hace 11 meses
- **WHEN** se ejecuta la purga programada
- **THEN** su chat se conserva

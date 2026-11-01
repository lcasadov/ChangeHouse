# Spec Delta

## ADDED Requirements

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

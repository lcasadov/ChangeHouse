# Spec Delta

## Purpose

Lista de espera de la fase 0: recoge el interés de propietarios antes del
lanzamiento de la app, con su consentimiento y sin exponer quién se ha apuntado.

## ADDED Requirements

### Requirement: Alta en la lista de espera

El sistema SHALL aceptar el alta de un visitante en la lista de espera con
email, municipio, tipo de vivienda, qué busca y la aceptación de la política de
privacidad, SHALL guardar la fecha del consentimiento y SHALL responder que el
alta ha sido aceptada.

#### Scenario: Alta correcta
- **GIVEN** un visitante con un email que no está en la lista
- **WHEN** envía email, municipio, tipo de vivienda, qué busca y acepta la privacidad
- **THEN** el sistema responde que el alta está aceptada (202) y la inscripción queda guardada con la fecha del consentimiento

#### Scenario: Sin aceptar la privacidad
- **GIVEN** un visitante que no marca la aceptación de la privacidad
- **WHEN** envía el formulario
- **THEN** el sistema rechaza el alta (400) indicando el campo de consentimiento y no guarda nada

### Requirement: Validación de los datos

El sistema SHALL rechazar las altas con datos que no cumplen el contrato
(email no válido, campos vacíos, tipo de vivienda fuera de la lista, textos más
largos de lo permitido) indicando cada campo erróneo, y MUST NOT guardar
nada en ese caso.

#### Scenario: Email no válido
- **GIVEN** un visitante que escribe «juan@» como email
- **WHEN** envía el formulario
- **THEN** recibe un error 400 con el campo `email` señalado y no se guarda ninguna inscripción

#### Scenario: Tipo de vivienda desconocido
- **GIVEN** un alta con un tipo de vivienda que no está en la lista cerrada
- **WHEN** se envía
- **THEN** se rechaza con 400 señalando `homeType`

### Requirement: Inscripciones repetidas sin revelar

El sistema SHALL responder a un email ya inscrito exactamente igual que a uno
nuevo, MUST NOT crear una segunda inscripción y MUST NOT revelar en la
respuesta si el email ya estaba en la lista.

#### Scenario: Email ya inscrito
- **GIVEN** un email que ya está en la lista
- **WHEN** se envía un alta con ese email, en mayúsculas o minúsculas
- **THEN** la respuesta es la misma que para un alta nueva (202, mismo cuerpo) y sigue habiendo una sola inscripción para ese email

### Requirement: Protección frente al abuso

El sistema SHALL limitar el número de altas por origen en una ventana de tiempo
y, al superarlo, SHALL responder 429 con la cabecera `Retry-After` sin procesar
el alta.

#### Scenario: Demasiadas altas seguidas
- **GIVEN** un mismo origen que ya ha alcanzado el límite de altas de la ventana
- **WHEN** envía otra alta
- **THEN** recibe 429 con `Retry-After` y la inscripción no se guarda

### Requirement: Formulario en la landing

La landing SHALL ofrecer el formulario de lista de espera en la sección
`#lista-de-espera`, con validación junto a cada campo, prevención del doble
envío, confirmación clara al terminar y un mensaje que diga qué hacer si falla.

#### Scenario: Envío correcto
- **GIVEN** un visitante que rellena el formulario con datos válidos
- **WHEN** lo envía
- **THEN** el botón queda deshabilitado mientras se envía y después se muestra el mensaje de confirmación, anunciado a los lectores de pantalla

#### Scenario: Error de validación en un campo
- **GIVEN** un visitante que deja el municipio vacío
- **WHEN** sale del campo o envía
- **THEN** ve el error debajo del campo, asociado a él para los lectores de pantalla

#### Scenario: Fallo de red o límite superado
- **GIVEN** que la API no responde o devuelve 429
- **WHEN** el visitante envía el formulario
- **THEN** ve un mensaje que explica el problema y le invita a reintentarlo más tarde, y sus datos siguen en el formulario

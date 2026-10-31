# Spec Delta

## Purpose

Avisos al usuario: qué eventos le notifica ChangeHouse, por qué canal, cuándo se
pide permiso y qué información nunca viaja en un aviso.

## ADDED Requirements

### Requirement: Registro del dispositivo y permiso contextual

La app SHALL pedir permiso de notificaciones la primera vez que el usuario da
«Me gusta», no al abrirla, y SHALL registrar el token del dispositivo en la API;
los tokens que el servicio de mensajería declare inválidos SHALL eliminarse.

#### Scenario: Permiso tras el primer me gusta
- **GIVEN** un usuario que nunca ha concedido ni denegado el permiso
- **WHEN** da su primer «Me gusta»
- **THEN** la app le explica para qué sirven los avisos y pide el permiso; si lo concede, registra el dispositivo

#### Scenario: Token inválido
- **GIVEN** un dispositivo cuyo token ya no es válido
- **WHEN** el servicio de mensajería rechaza un envío por ese motivo
- **THEN** el token se elimina y no se vuelve a usar

### Requirement: Avisos push de los eventos clave

El sistema SHALL enviar un aviso push a cada participante afectado cuando se
crea un match, cuando llega un mensaje de otro participante y cuando el match
pasa a `confirmed` o `closed`; tocar el aviso SHALL abrir el match o su chat.

#### Scenario: Nuevo match
- **GIVEN** un usuario con un dispositivo registrado
- **WHEN** se crea un match en el que participa
- **THEN** recibe el aviso «¡Tienes un match!» y al tocarlo se abre el match

#### Scenario: Nuevo mensaje
- **GIVEN** dos participantes con dispositivos registrados
- **WHEN** uno envía un mensaje
- **THEN** solo el otro recibe el aviso, y al tocarlo se abre el chat

#### Scenario: Fallo del envío
- **GIVEN** que el servicio de mensajería no responde
- **WHEN** se intenta enviar un aviso
- **THEN** el evento de negocio no se ve afectado y el aviso se reintenta

### Requirement: Avisos por email

El sistema SHALL enviar un email al crearse un match y al cerrarse, con un enlace
a la app, en español y con la marca de ChangeHouse.

#### Scenario: Email de nuevo match
- **GIVEN** un usuario con email verificado
- **WHEN** se crea un match en el que participa
- **THEN** recibe un email «Tienes un match en ChangeHouse» con un botón que abre el match

### Requirement: Avisos sin datos privados

Ningún aviso push ni email MUST incluir direcciones, teléfonos, importes ni el
contenido de los mensajes; solo el tipo de evento, el nombre visible del otro
participante y el enlace.

#### Scenario: Aviso de mensaje
- **GIVEN** un mensaje que contiene una dirección
- **WHEN** se genera su aviso push
- **THEN** el aviso dice «Nuevo mensaje de Ana» sin mostrar el contenido

# Tasks

## 1. Reglas y canal

- [x] T1 Escribir las pruebas de las reglas de Firestore con el emulador (participante lee, ajeno no lee, nadie escribe desde el cliente) y comprobar que fallan con las reglas actuales donde corresponda. ref: Solo los participantes leen el chat · est: 2h · disc: qa
  - GIVEN un usuario ajeno WHEN lee `chats/{chatId}/messages` THEN la regla deniega el acceso
- [x] B1 Escribir las reglas del chat en `firebase/firestore.rules`, añadir el emulador de Firestore al job de integración de la CI y verificar que pasan las pruebas de T1. ref: Solo los participantes leen el chat · est: 2h · disc: back
  - GIVEN un participante WHEN escribe directamente un mensaje THEN la regla deniega la escritura

## 2. API

- [x] B2 Crear la tabla `outbox` con su migración, añadir `sendMatchMessage` y `createChatImageUpload` al contrato y verificar la migración y la validación de Redocly. ref: Chat de grupo por match · est: 2h · disc: bd
  - GIVEN el contrato actualizado WHEN se valida con Redocly THEN no hay errores
- [x] T2 Escribir las pruebas de integración de la creación del chat por el outbox (incluido el reintento tras un fallo de Firestore), del envío de texto e imagen, de los límites (vacío, 2.001 caracteres), del 409 en match cerrado y del 404 a usuarios ajenos, con sus filas en la matriz, y comprobar que fallan. ref: Enviar mensajes · est: 4h · disc: qa
  - GIVEN un fallo de Firestore al crear el match WHEN se reintenta el despacho THEN el chat acaba creado una sola vez
- [x] B3 Implementar el puerto `ChatChannel` con el adaptador de Firestore, el despachador del outbox, los casos de uso y las rutas, y verificar que pasan las pruebas de T2. ref: Chat de un match cerrado · est: 6h · disc: back
  - GIVEN un match `closed` WHEN se envía un mensaje THEN la respuesta es 409

## 3. App

- [x] T3 Escribir las pruebas de componentes del chat (lista en tiempo real con un emulador simulado, envío optimista, «No enviado» con reintento, imagen, solo lectura con aviso) y comprobar que fallan. ref: Enviar mensajes · est: 3h · disc: qa
  - GIVEN un envío sin conexión WHEN falla THEN el mensaje muestra «No enviado» y «Reintentar»
- [x] F1 Implementar la pantalla de chat con el listener de Firestore, el envío por la API, las imágenes y el modo de solo lectura, y verificar que pasan las pruebas de T3. ref: Chat de grupo por match · est: 7h · disc: front
  - GIVEN un mensaje nuevo de otro participante WHEN llega THEN aparece sin recargar y se anuncia a los lectores de pantalla

## 4. Integración

- [x] V1 Ejecutar `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage`, `pnpm test:integration` (PostgreSQL y emuladores) y `pnpm build` y verificar que todo pasa con cobertura ≥ 80 %. ref: Enviar mensajes · est: 1h · disc: qa
  - GIVEN el change implementado WHEN se ejecuta la puerta de calidad local THEN todos los comandos terminan con éxito

## Workflow follow-up

- `/opsx:verify`, `/opsx:sync` y `/opsx:archive` tras la implementación.

# Tasks

## 1. API

- [x] T1 Escribir las pruebas de integración de `PUT /me` para la edición del perfil (valores válidos, nombre vacío o largo, teléfono no E.164) y comprobar que fallan. ref: Edición del perfil · est: 2h · disc: qa
  - GIVEN un teléfono «612345678» sin prefijo WHEN se envía THEN la respuesta es 400 con `phone` señalado
- [x] B1 Ajustar la validación de `upsertMe` con el esquema de perfil compartido y verificar que pasan las pruebas de T1. ref: Edición del perfil · est: 2h · disc: back
  - GIVEN un perfil válido WHEN se guarda THEN `GET /me` devuelve los nuevos valores
- [x] T2 Escribir la prueba que recorre las respuestas de las operaciones existentes para otros usuarios y comprueba que ninguna incluye el teléfono, y comprobar que falla si se expone. ref: Privacidad del teléfono · est: 1h · disc: qa
  - GIVEN un usuario con teléfono WHEN otro usuario consulta cualquier operación disponible THEN la respuesta no contiene el teléfono

## 2. App

- [x] T3 Escribir las pruebas de componentes de la pestaña «Perfil» (ver ficha, guardar, errores por campo, cerrar sesión con confirmación) y comprobar que fallan. ref: Edición del perfil · est: 2h · disc: qa
  - GIVEN la ficha editada WHEN se guarda con éxito THEN se anuncia la confirmación
- [x] F1 Implementar la ficha y el formulario de perfil con React Hook Form y el esquema compartido, el cierre de sesión con confirmación, y verificar que pasan las pruebas de T3. ref: Edición del perfil · est: 4h · disc: front
  - GIVEN el formulario WHEN se envía dos veces seguidas THEN solo se hace una petición

## 3. Integración

- [x] V1 Ejecutar `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage`, `pnpm test:integration` y `pnpm build` y verificar que todo pasa con cobertura ≥ 80 %. ref: Edición del perfil · est: 1h · disc: qa
  - GIVEN el change implementado WHEN se ejecuta la puerta de calidad local THEN todos los comandos terminan con éxito

## Workflow follow-up

- `/opsx:verify`, `/opsx:sync` y `/opsx:archive` tras la implementación.

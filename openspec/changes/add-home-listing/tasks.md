# Tasks

## 1. Dominio y persistencia

- [x] T1 Escribir las pruebas del dominio `Home` (estados y transiciones, completitud para el envío, rango de valor, edición prohibida en `in_operation`/`closed`) y comprobar que fallan. ref: Envío a revisión · est: 3h · disc: qa
  - GIVEN una vivienda en `closed` WHEN se intenta editar THEN el dominio lanza `HomeNotEditableError`
- [x] B1 Implementar la entidad `Home`, `Money` y sus reglas, y verificar que pasan las pruebas de T1. ref: Alta de vivienda en borrador · est: 3h · disc: back
  - GIVEN un mínimo mayor que el máximo WHEN se crea el rango THEN el dominio lo rechaza
- [x] B2 Crear la tabla `homes` con su migración (PostGIS, `location_visibility`, `area_name`, `relevant_changed_at`, dirección cifrada) y el cifrado AES-256-GCM con versión de clave, con pruebas unitarias del cifrado de ida y vuelta, y verificar que la migración se aplica. ref: Ubicación y dirección privada · est: 3h · disc: bd
  - GIVEN una dirección cifrada WHEN se descifra con la misma clave THEN se obtiene el texto original y con otra clave falla

## 2. API de viviendas

- [x] T2 Escribir las pruebas de integración de `createHome`, `updateHome`, `listMyHomes`, `getHome` (completa, pública, 404 ajena no publicada), `submitHome` (422 incompleta) y 403 para `agency`/`admin`, con el `FixturePlaceResolver`, y añadir sus filas a la matriz como datos; comprobar que fallan. ref: Detalle de vivienda según quién la consulta · est: 4h · disc: qa
  - GIVEN una vivienda ajena en `draft` WHEN se consulta THEN la respuesta es 404 idéntica a la de un identificador inexistente
- [x] B3 Implementar el puerto `PlaceResolver` con el adaptador de Google Places y el de pruebas, los casos de uso, el repositorio Drizzle y las rutas, y verificar que pasan las pruebas de T2 y la matriz. ref: Ubicación y dirección privada · est: 6h · disc: back
  - GIVEN una vivienda publicada con `area` WHEN la consulta otro usuario THEN `location.point` es el centro del barrio o zona y no hay `address`
- [x] T3 Escribir las pruebas del rol derivado (vivienda en `in_review` → `seeker`; publicada, pausada o en operación → `owner`) y comprobar que fallan. ref: Rol de propietario derivado de sus viviendas · est: 1h · disc: qa
  - GIVEN un usuario con una vivienda en `in_review` WHEN consulta `GET /me` THEN su rol es `seeker`
- [x] B4 Implementar `DrizzleHomeOwnership` en sustitución del provisional y verificar que pasan las pruebas de T3. ref: Rol de propietario derivado de sus viviendas · est: 1h · disc: back
  - GIVEN una vivienda que pasa a `published` WHEN el propietario consulta su cuenta THEN su rol es `owner`

## 3. App

- [ ] T4 Escribir las pruebas de componentes del asistente (guardado por paso, reanudar borrador, rango incoherente, dirección no resuelta, elección de visibilidad) y de «Mis casas» (varias viviendas con estado, estado vacío), y comprobar que fallan. ref: Alta de vivienda en borrador · est: 4h · disc: qa
  - GIVEN un borrador con el primer paso hecho WHEN se reabre THEN el asistente continúa en el segundo paso con los datos guardados
- [ ] F1 Implementar «Mis casas» y el asistente de 5 pasos con autocompletado de direcciones (sugerencias de prueba sin clave), visibilidad de la ubicación y revisión final con envío, y verificar que pasan las pruebas de T4. ref: Varias viviendas por usuario · est: 8h · disc: front
  - GIVEN «Mis casas» sin viviendas WHEN se abre THEN aparece el estado vacío con el botón para publicar la primera
- [ ] F2 Implementar el detalle de vivienda para el propietario con su estado y la acción de enviar a revisión, y verificar sus pruebas de componentes. ref: Envío a revisión · est: 3h · disc: front
  - GIVEN una vivienda enviada WHEN responde la API THEN el estado mostrado pasa a «En revisión»

## 4. Integración

- [ ] V1 Ejecutar `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage`, `pnpm test:integration` y `pnpm build` y verificar que todo pasa con cobertura ≥ 80 %. ref: Alta de vivienda en borrador · est: 1h · disc: qa
  - GIVEN el change implementado WHEN se ejecuta la puerta de calidad local THEN todos los comandos terminan con éxito

## Workflow follow-up

- `/opsx:verify`, `/opsx:sync` y `/opsx:archive` tras la implementación.

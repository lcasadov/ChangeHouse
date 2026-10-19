# Tasks

## 1. API

- [ ] B1 Crear la tabla `search_preferences` (por usuario con `home_id` nulo o por vivienda, zonas en PostGIS y municipios, `value_reference_pct` 0–100) con sus restricciones de unicidad y su migración, y verificar que se aplica. ref: Preferencias por defecto del usuario · est: 2h · disc: bd
  - GIVEN dos preferencias por defecto para el mismo usuario WHEN se insertan THEN la segunda viola la restricción de unicidad
- [ ] T1 Escribir las pruebas de integración de las cinco operaciones de preferencias (guardar y leer, sin zona 422, punto fuera de rango 400, preferencias por vivienda que sustituyen, borrado y 404, vivienda ajena 404) con sus filas en la matriz, y comprobar que fallan. ref: Preferencias propias de una vivienda · est: 3h · disc: qa
  - GIVEN preferencias propias de una vivienda WHEN se resuelven las efectivas para ella THEN se usan las propias y no las del usuario
- [ ] B2 Implementar los casos de uso (incluida la resolución de las preferencias efectivas de una vivienda, que usará el descubrimiento), el repositorio y las rutas, y verificar que pasan las pruebas de T1. ref: Preferencias por defecto del usuario · est: 4h · disc: back
  - GIVEN una vivienda sin preferencias propias WHEN se resuelven sus preferencias efectivas THEN son las del usuario

## 2. App

- [ ] T2 Escribir las pruebas de componentes de la barra «¿Dónde quieres vivir?», los chips, la hoja de filtros y compensación, y el paso de primer uso, y comprobar que fallan. ref: Búsqueda en un toque · est: 3h · disc: qa
  - GIVEN un usuario sin preferencias WHEN entra en «Explorar» THEN ve el paso de primer uso
- [ ] F1 Implementar la búsqueda en un toque (autocompletado con sugerencias de prueba sin clave, chips accesibles, hoja inferior con compensación y punto del rango) y el paso de primer uso, y verificar que pasan las pruebas de T2. ref: Búsqueda en un toque · est: 6h · disc: front
  - GIVEN el chip «Garaje» WHEN se toca THEN su estado se anuncia como activado
- [ ] F2 Implementar en el detalle de una vivienda propia la opción «Preferencias de esta vivienda» (definir, editar, volver a las del usuario) y verificar sus pruebas de componentes. ref: Preferencias propias de una vivienda · est: 3h · disc: front
  - GIVEN una vivienda con preferencias propias WHEN se elige «Usar las mías» THEN se eliminan y se muestran las del usuario

## 3. Integración

- [ ] V1 Ejecutar `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage`, `pnpm test:integration` y `pnpm build` y verificar que todo pasa con cobertura ≥ 80 %. ref: Preferencias por defecto del usuario · est: 1h · disc: qa
  - GIVEN el change implementado WHEN se ejecuta la puerta de calidad local THEN todos los comandos terminan con éxito

## Workflow follow-up

- `/opsx:verify`, `/opsx:sync` y `/opsx:archive` tras la implementación.

# Tasks

## 1. API

- [ ] T1 Escribir las pruebas de dominio e integración de pausar, reactivar, 409 fuera de estado, conservación de matches, exclusión del descubrimiento y vuelta a revisión (valor sí, visibilidad no), con sus filas en la matriz, y comprobar que fallan. ref: Pausar y reactivar · est: 3h · disc: qa
  - GIVEN una vivienda pausada WHEN se consulta el descubrimiento THEN no aparece
- [ ] B1 Implementar las transiciones en el dominio, la regla de cambio relevante (con `relevant_changed_at`) y las rutas `pauseHome` y `resumeHome`, y verificar que pasan las pruebas de T1. ref: Vuelta a revisión tras cambios relevantes · est: 3h · disc: back
  - GIVEN un cambio de rango de valor en una vivienda publicada WHEN se guarda THEN pasa a `in_review`

## 2. App

- [ ] T2 Escribir las pruebas de componentes de pausar y reactivar en «Mis casas» y del aviso previo a un cambio relevante, y comprobar que fallan. ref: Vuelta a revisión tras cambios relevantes · est: 2h · disc: qa
  - GIVEN un cambio de valor en una vivienda publicada WHEN se va a guardar THEN se avisa de que volverá a revisión
- [ ] F1 Implementar las acciones y el aviso, y verificar que pasan las pruebas de T2. ref: Pausar y reactivar · est: 3h · disc: front
  - GIVEN una vivienda pausada WHEN se muestra en «Mis casas» THEN ofrece «Reactivar»

## 3. Integración

- [ ] V1 Ejecutar `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage`, `pnpm test:integration` y `pnpm build` y verificar que todo pasa con cobertura ≥ 80 %. ref: Pausar y reactivar · est: 1h · disc: qa
  - GIVEN el change implementado WHEN se ejecuta la puerta de calidad local THEN todos los comandos terminan con éxito

## Workflow follow-up

- `/opsx:verify`, `/opsx:sync` y `/opsx:archive` tras la implementación.

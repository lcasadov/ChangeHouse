# Tasks

## 1. API

- [x] T1 Escribir las pruebas de integración de `adminSetUserSuspension` (con motivo, sin motivo 400, auto-suspensión prohibida, auditoría) y del efecto de la suspensión (403 `ACCOUNT_SUSPENDED` en las operaciones, excepto cuenta y exportación; viviendas fuera del descubrimiento; matches cerrados; reactivación), con su fila en la matriz, y comprobar que fallan. ref: Efecto de la suspensión · est: 4h · disc: qa
  - GIVEN un usuario suspendido WHEN invoca `likeHome` THEN recibe 403 con `ACCOUNT_SUSPENDED`
- [x] B1 Implementar las columnas de suspensión con su migración, la comprobación en el punto central de autorización, el caso de uso auditado con cierre de matches y la ruta, y verificar que pasan las pruebas de T1. ref: Suspender y reactivar usuarios · est: 5h · disc: back
  - GIVEN un usuario reactivado WHEN usa la app THEN recupera el acceso y sus matches siguen cerrados

## 2. App

- [x] T2 Escribir las pruebas de componentes de la pantalla de cuenta suspendida y de la acción de suspender en «Administración», y comprobar que fallan. ref: Efecto de la suspensión · est: 2h · disc: qa
  - GIVEN una respuesta 403 `ACCOUNT_SUSPENDED` WHEN llega THEN la app muestra la pantalla de cuenta suspendida
- [x] F1 Implementar la pantalla y la acción, y verificar que pasan las pruebas de T2. ref: Suspender y reactivar usuarios · est: 3h · disc: front
  - GIVEN la pantalla de cuenta suspendida WHEN se muestra THEN ofrece exportar los datos y cerrar sesión

## 3. Integración

- [ ] V1 Ejecutar `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage`, `pnpm test:integration` y `pnpm build` y verificar que todo pasa con cobertura ≥ 80 %. ref: Suspender y reactivar usuarios · est: 1h · disc: qa
  - GIVEN el change implementado WHEN se ejecuta la puerta de calidad local THEN todos los comandos terminan con éxito

## Workflow follow-up

- `/opsx:verify`, `/opsx:sync` y `/opsx:archive` tras la implementación.

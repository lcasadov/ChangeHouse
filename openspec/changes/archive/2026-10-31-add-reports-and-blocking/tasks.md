# Tasks

## 1. API

- [x] B1 Crear las tablas `reports` (estados, evidencia del mensaje, resolución) y `user_blocks` con su migración, y verificar que se aplica. ref: Denunciar · est: 2h · disc: bd
  - GIVEN un bloqueo de un usuario a sí mismo WHEN se inserta THEN la restricción lo rechaza
- [x] T1 Escribir las pruebas de integración de `createReport` (vivienda, usuario, mensaje con evidencia, mensaje ajeno 404, límite 429), `blockUser` (exclusión mutua del descubrimiento, sin matches nuevos), `adminListReports` y `adminResolveReport` con auditoría, con sus filas en la matriz, y comprobar que fallan. ref: Bloquear a un usuario · est: 4h · disc: qa
  - GIVEN dos usuarios bloqueados con likes cruzados WHEN se cierra el ciclo THEN no se crea el match
- [x] B2 Implementar los casos de uso y rutas de denuncias y bloqueos, el filtro de bloqueos en el descubrimiento y en el validador de ciclos, y la resolución auditada, y verificar que pasan las pruebas de T1. ref: Revisión de denuncias · est: 6h · disc: back
  - GIVEN una denuncia resuelta WHEN se consulta la auditoría THEN aparece la entrada correspondiente

## 2. App

- [x] T2 Escribir las pruebas de componentes de «Denunciar» (tarjeta, match, mensaje), «Bloquear» con confirmación y la cola de denuncias del admin, y comprobar que fallan. ref: Denunciar · est: 3h · disc: qa
  - GIVEN «Bloquear» pulsado WHEN aparece la confirmación THEN explica que dejaréis de veros
- [x] F1 Implementar las acciones de denunciar y bloquear y la cola de denuncias en «Administración», y verificar que pasan las pruebas de T2. ref: Revisión de denuncias · est: 5h · disc: front
  - GIVEN una denuncia enviada WHEN responde la API THEN se confirma que el equipo la revisará

## 3. Integración

- [x] V1 Ejecutar `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage`, `pnpm test:integration` y `pnpm build` y verificar que todo pasa con cobertura ≥ 80 %. ref: Denunciar · est: 1h · disc: qa
  - GIVEN el change implementado WHEN se ejecuta la puerta de calidad local THEN todos los comandos terminan con éxito

## Workflow follow-up

- `/opsx:verify`, `/opsx:sync` y `/opsx:archive` tras la implementación.

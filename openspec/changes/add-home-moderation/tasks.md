# Tasks

## 1. API de moderación

- [ ] B1 Crear la tabla `audit_log` (solo inserción: sin permisos de `UPDATE`/`DELETE` para el rol de la aplicación) con su migración y el script `pnpm --filter @changehouse/api admin:grant <email>`, y verificar la migración y el script contra el PostgreSQL local. ref: Registro de auditoría de la moderación · est: 2h · disc: bd
  - GIVEN un usuario existente WHEN se ejecuta `admin:grant` con su email THEN su `assigned_role` pasa a `admin`
- [ ] T1 Escribir las pruebas de dominio y de integración de la moderación (cola ordenada, vacía, 403 sin rol, aprobar, rechazar con y sin motivo, 409 fuera de revisión, auditoría en la misma transacción y fallo de auditoría que revierte), con sus filas en la matriz, y comprobar que fallan. ref: Aprobación y rechazo con motivo · est: 4h · disc: qa
  - GIVEN un fallo simulado del registro de auditoría WHEN se aprueba THEN la vivienda sigue en `in_review`
- [ ] B2 Implementar las transiciones `in_review → published | draft` en el dominio, el puerto `AuditLog`, los casos de uso transaccionales y las rutas `adminListHomes` y `adminModerateHome`, y verificar que pasan las pruebas de T1. ref: Cola de moderación de viviendas · est: 4h · disc: back
  - GIVEN una vivienda aprobada WHEN su propietario consulta `GET /me` THEN su rol es `owner`

## 2. App

- [ ] T2 Escribir las pruebas de componentes de la sección de administración (visible solo para `admin`, cola, aprobar, rechazar con motivo obligatorio) y del motivo de rechazo en «Mis casas», y comprobar que fallan. ref: Aprobación y rechazo con motivo · est: 3h · disc: qa
  - GIVEN un usuario `owner` WHEN abre la app THEN no ve la sección de administración
- [ ] F1 Implementar la sección «Administración» con la cola, el detalle con fotos y las acciones, y el aviso de rechazo con su motivo en «Mis casas», y verificar que pasan las pruebas de T2. ref: Cola de moderación de viviendas · est: 5h · disc: front
  - GIVEN una vivienda rechazada WHEN su propietario abre «Mis casas» THEN ve el motivo y puede corregirla y reenviarla

## 3. Integración

- [ ] V1 Ejecutar `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage`, `pnpm test:integration` y `pnpm build` y verificar que todo pasa con cobertura ≥ 80 %. ref: Cola de moderación de viviendas · est: 1h · disc: qa
  - GIVEN el change implementado WHEN se ejecuta la puerta de calidad local THEN todos los comandos terminan con éxito

## Workflow follow-up

- `/opsx:verify`, `/opsx:sync` y `/opsx:archive` tras la implementación.

# Tasks

## 1. API

- [ ] T1 Escribir las pruebas de integración de `adminGetMetrics` (totales y agrupación por zona, periodo invertido 400), `adminListUsers` (búsqueda y paginación), `adminListAuditLog` (orden) y `adminListWaitlist` (filtro, CSV, 403 sin rol), con sus filas en la matriz, y comprobar que fallan. ref: Métricas del producto · est: 4h · disc: qa
  - GIVEN la cabecera `Accept: text/csv` WHEN se consulta la lista de espera THEN la respuesta es un CSV con las cinco columnas
- [ ] B1 Implementar las consultas agregadas, los casos de uso y las cuatro rutas, y verificar que pasan las pruebas de T1. ref: Lista de espera para el equipo · est: 5h · disc: back
  - GIVEN matches directos y en cadena en el periodo WHEN se consultan las métricas THEN se cuentan por separado

## 2. App

- [ ] T2 Escribir las pruebas de componentes del panel de métricas, la tabla de usuarios con búsqueda, la auditoría y la lista de espera con exportación, incluida la vista en tarjetas en pantalla estrecha, y comprobar que fallan. ref: Gestión de usuarios · est: 3h · disc: qa
  - GIVEN una pantalla de 375 px WHEN se muestra la tabla de usuarios THEN se presenta como tarjetas sin desplazamiento horizontal
- [ ] F1 Implementar las cuatro vistas en «Administración» y verificar que pasan las pruebas de T2. ref: Consulta de la auditoría · est: 6h · disc: front
  - GIVEN el botón «Exportar CSV» WHEN se pulsa THEN se descarga el fichero

## 3. Integración

- [ ] V1 Ejecutar `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage`, `pnpm test:integration` y `pnpm build` y verificar que todo pasa con cobertura ≥ 80 %. ref: Métricas del producto · est: 1h · disc: qa
  - GIVEN el change implementado WHEN se ejecuta la puerta de calidad local THEN todos los comandos terminan con éxito

## Workflow follow-up

- `/opsx:verify`, `/opsx:sync` y `/opsx:archive` tras la implementación.

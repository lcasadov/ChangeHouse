# Tasks

## 1. Detección

- [ ] T1 Escribir las pruebas de propiedades sobre grafos aleatorios (nunca ciclos > 3, todo ciclo devuelto existe, sin duplicados, suma cero) y las de integración de la cadena (compatible, eslabón incompatible, ciclo de cuatro, directo y cadena a la vez), y comprobar que fallan. ref: Match en cadena de tres · est: 4h · disc: qa
  - GIVEN un grafo aleatorio de likes WHEN se detectan ciclos THEN ninguno tiene más de tres viviendas
- [ ] B1 Implementar la consulta de ciclos de longitud 3 en `CycleCandidates` (README §11) y su validación con el dominio existente, y verificar que pasan las pruebas de T1. ref: Match en cadena de tres · est: 4h · disc: back
  - GIVEN un like que cierra un ciclo de tres compatible WHEN responde la API THEN el match tiene tres participantes
- [ ] T2 Escribir la prueba de rendimiento con 50.000 viviendas y 500.000 likes sintéticos y comprobar el tiempo actual de detección. ref: Rendimiento de la detección · est: 2h · disc: qa
  - GIVEN el volumen objetivo WHEN se registra un like THEN la detección tarda menos de 1 s
- [ ] B2 Ajustar índices y consulta (revisando `EXPLAIN ANALYZE`) hasta cumplir la prueba de T2, con su migración. ref: Rendimiento de la detección · est: 3h · disc: bd
  - GIVEN los índices creados WHEN se analiza la consulta THEN usa índices sobre `likes(from_home_id)` y `likes(to_home_id, from_home_id)`

## 2. App

- [ ] T3 Escribir las pruebas de componentes de la celebración en triángulo y de la lista y el detalle con tres participantes, y comprobar que fallan. ref: Presentación de la cadena · est: 2h · disc: qa
  - GIVEN un match en cadena WHEN se abre su detalle THEN se ven tres viviendas con quién entrega a quién
- [ ] F1 Implementar la celebración en triángulo y la presentación de tres viviendas en lista y detalle, y verificar que pasan las pruebas de T3. ref: Presentación de la cadena · est: 5h · disc: front
  - GIVEN «reducir movimiento» activo WHEN aparece la celebración en cadena THEN se usa un fundido

## 3. Integración

- [ ] V1 Ejecutar `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage`, `pnpm test:integration` y `pnpm build` y verificar que todo pasa con cobertura ≥ 80 %. ref: Match en cadena de tres · est: 1h · disc: qa
  - GIVEN el change implementado WHEN se ejecuta la puerta de calidad local THEN todos los comandos terminan con éxito

## Workflow follow-up

- `/opsx:verify`, `/opsx:sync` y `/opsx:archive` tras la implementación.

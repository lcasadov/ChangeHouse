# Tasks

## 1. Dominio del matching

- [ ] T1 Escribir las pruebas unitarias y de propiedades (fast-check) del validador de ciclos: suma de compensaciones cero, ningún match fuera de los límites de pago y cobro, clave canónica estable ante rotaciones, rechazo si alguna vivienda no está publicada; comprobar que fallan. ref: Compensaciones del match · est: 3h · disc: qa
  - GIVEN cualquier ciclo aceptado WHEN se suman sus compensaciones THEN el resultado es 0
- [ ] B1 Implementar `domain/matching/cycle.ts` (validación, compensaciones por participante, clave canónica) y verificar que pasan las pruebas de T1. ref: Match directo · est: 3h · disc: back
  - GIVEN el ciclo [B, A] y el ciclo [A, B] WHEN se calcula su clave THEN es la misma

## 2. Persistencia y transacción

- [ ] B2 Crear las tablas `matches` (`cycle_key` única, tipo 2 o 3, estado) y `match_participants` (compensación, estado) con su migración, y verificar que se aplica. ref: Un solo match por ciclo · est: 2h · disc: bd
  - GIVEN dos matches con la misma clave WHEN se insertan THEN el segundo viola la restricción
- [ ] T2 Escribir las pruebas de integración del match directo (recíproco compatible, incompatible, vivienda pausada, likes simultáneos repetidos varias veces con barrera) y de `listMyMatches` (orden, solo propios, vacío), con sus filas en la matriz, y comprobar que fallan. ref: Un solo match por ciclo · est: 4h · disc: qa
  - GIVEN dos likes simultáneos que cierran el mismo ciclo WHEN terminan THEN existe un solo match y ambas peticiones responden 201
- [ ] B3 Implementar el puerto `CycleCandidates` con la consulta de ciclos de 2, la creación transaccional con `ON CONFLICT DO NOTHING RETURNING`, la respuesta de `likeHome` con el match y la ruta `listMyMatches`, y verificar que pasan las pruebas de T2. ref: Match directo · est: 6h · disc: back
  - GIVEN un like que cierra un ciclo compatible WHEN responde la API THEN el cuerpo incluye el match con sus dos participantes

## 3. App

- [ ] T3 Escribir las pruebas de componentes de la celebración (aparece con match, anuncio accesible, «Ver match», «reducir movimiento») y de la pestaña «Matches» (lista y vacío), y comprobar que fallan. ref: Celebración del match · est: 3h · disc: qa
  - GIVEN una respuesta de like con match WHEN llega THEN se anuncia «¡Tenéis un match!»
- [ ] F1 Implementar la celebración de pantalla completa con la animación de intercambio y la pestaña «Matches» con su lista y estado vacío, y verificar que pasan las pruebas de T3. ref: Lista de matches · est: 6h · disc: front
  - GIVEN un match nuevo WHEN se cierra la celebración THEN «Matches» lo muestra el primero

## 4. Integración

- [ ] V1 Ejecutar `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage`, `pnpm test:integration` y `pnpm build` y verificar que todo pasa con cobertura ≥ 80 %. ref: Match directo · est: 1h · disc: qa
  - GIVEN el change implementado WHEN se ejecuta la puerta de calidad local THEN todos los comandos terminan con éxito

## Workflow follow-up

- `/opsx:verify`, `/opsx:sync` y `/opsx:archive` tras la implementación.

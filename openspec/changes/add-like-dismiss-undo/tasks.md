# Tasks

## 1. API

- [x] B1 Crear las tablas `likes` y `dismissals` (claves compuestas, sin auto-referencias, índices por origen, destino y fecha) con su migración, y verificar que se aplica. ref: Me gusta desde una vivienda propia · est: 2h · disc: bd
  - GIVEN un like de una vivienda a sí misma WHEN se inserta THEN la restricción lo rechaza
- [x] T1 Escribir las pruebas de integración de `likeHome` (válido, `seeker` 403, origen ajeno 404, propio no publicado 409, repetido 409, límite diario 429 con `Retry-After`), `dismissHome` y `undoLastAction` (deshacer descarte y like, 409 si hay match), con sus filas en la matriz, y comprobar que fallan. ref: Límite diario de me gusta · est: 4h · disc: qa
  - GIVEN 10 likes hoy WHEN se da el undécimo THEN la respuesta es 429 con `Retry-After` hasta la medianoche de Madrid
- [x] B2 Implementar los casos de uso, los repositorios y las rutas con el límite configurable y el reloj inyectado, y verificar que pasan las pruebas de T1. ref: Me gusta desde una vivienda propia · est: 5h · disc: back
  - GIVEN un like válido WHEN se registra THEN la vivienda deja de aparecer en `discoverHomes`
- [x] B3 Implementar el deshacer sobre la última acción por vivienda (o por cuenta para `seeker`) y verificar sus pruebas de T1. ref: Deshacer la última acción · est: 2h · disc: back
  - GIVEN un descarte deshecho WHEN se consulta el descubrimiento THEN la vivienda vuelve a aparecer

## 2. App

- [x] T2 Escribir las pruebas de componentes de los botones «Me gusta» y «Descartar», la barra de deshacer de 5 s, el aviso a `seeker`, el mensaje del límite diario y el modo «reducir movimiento», y comprobar que fallan. ref: Decidir con un gesto · est: 3h · disc: qa
  - GIVEN «reducir movimiento» activo WHEN se descarta THEN no se ejecuta la animación de vuelo
- [x] F1 Implementar el gesto de deslizar con `react-native-gesture-handler` y Reanimated, los botones accesibles, la háptica con `expo-haptics`, la barra de deshacer y los mensajes, con actualización optimista y reversión ante error, y verificar que pasan las pruebas de T2. ref: Decidir con un gesto · est: 7h · disc: front
  - GIVEN un error de la API tras un me gusta optimista WHEN llega THEN la tarjeta vuelve y se muestra qué hacer

## 3. Integración

- [x] V1 Ejecutar `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage`, `pnpm test:integration` y `pnpm build` y verificar que todo pasa con cobertura ≥ 80 %. ref: Me gusta desde una vivienda propia · est: 1h · disc: qa
  - GIVEN el change implementado WHEN se ejecuta la puerta de calidad local THEN todos los comandos terminan con éxito

## Workflow follow-up

- `/opsx:verify`, `/opsx:sync` y `/opsx:archive` tras la implementación.

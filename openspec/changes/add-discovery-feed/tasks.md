# Tasks

## 1. Dominio de la compensación

- [ ] T1 Escribir las pruebas unitarias y de propiedades (fast-check) del valor de referencia, la compensación y la aceptabilidad bilateral (RN-03), incluido «Cambio justo» al 1 %, y comprobar que fallan. ref: Compensación visible en cada tarjeta · est: 3h · disc: qa
  - GIVEN dos viviendas cualesquiera WHEN se calcula la compensación en ambos sentidos THEN una es la opuesta de la otra
- [ ] B1 Implementar `domain/matching/compensation.ts` (valor de referencia, compensación, aceptabilidad, clasificación de la píldora) y verificar que pasan las pruebas de T1. ref: Viviendas compatibles en los dos sentidos · est: 2h · disc: back
  - GIVEN mi máximo a pagar de 30.000 € WHEN la diferencia es de 30.001 € THEN no es aceptable

## 2. Consulta de descubrimiento

- [ ] T2 Escribir las pruebas de integración de `discoverHomes` con PostgreSQL (compatibles en ambos sentidos, zona inversa, economía, paginación sin repetidos, exclusiones de propias, no publicadas, descartadas y cambio relevante, VPP, modo `seeker`) y la de rendimiento con datos sintéticos, con su fila en la matriz, y comprobar que fallan. ref: Viviendas excluidas · est: 5h · disc: qa
  - GIVEN 50.000 viviendas sintéticas WHEN se pide una página THEN la consulta termina en menos de 300 ms en el entorno de integración
- [ ] B2 Implementar la consulta en dos fases con PostGIS, los índices con su migración, el cursor y la ruta `discoverHomes`, y verificar que pasan las pruebas de T2. ref: Viviendas compatibles en los dos sentidos · est: 6h · disc: back
  - GIVEN una vivienda que pasa a `in_operation` WHEN se consulta el descubrimiento THEN no aparece
- [ ] B3 Implementar el modo sin vivienda publicada (preferencias por defecto, sin compatibilidad inversa ni compensación) y verificar sus pruebas de T2. ref: Descubrimiento sin vivienda publicada · est: 2h · disc: back
  - GIVEN un `seeker` WHEN consulta sin `homeId` THEN las tarjetas no incluyen compensación

## 3. App

- [ ] T3 Escribir las pruebas de componentes de «Explorar» (tarjeta con carrusel, píldora de cada tipo, detalle sin dirección, selector de vivienda, estado vacío con acceso a filtros, aviso de `seeker`) y comprobar que fallan. ref: Tarjetas a pantalla completa · est: 4h · disc: qa
  - GIVEN una tarjeta con compensación de 12.000 € a pagar WHEN se renderiza THEN la píldora dice «Tú pagas 12.000 €» con el token `compensationPay`
- [ ] F1 Implementar la pila de tarjetas a pantalla completa con `expo-image`, el degradado, la píldora, el selector de vivienda y el estado vacío, con datos de TanStack Query y paginación infinita, y verificar que pasan las pruebas de T3. ref: Tarjetas a pantalla completa · est: 8h · disc: front
  - GIVEN el final de la página WHEN quedan más resultados THEN se carga la siguiente sin repetir tarjetas
- [ ] F2 Implementar el detalle de vivienda ajena con galería, características y mapa de la ubicación pública, y verificar sus pruebas de componentes. ref: Tarjetas a pantalla completa · est: 4h · disc: front
  - GIVEN una vivienda con ubicación por zona WHEN se abre su detalle THEN el mapa muestra el centro de la zona y su nombre

## 4. Integración

- [ ] V1 Ejecutar `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage`, `pnpm test:integration` y `pnpm build` y verificar que todo pasa con cobertura ≥ 80 %. ref: Viviendas compatibles en los dos sentidos · est: 1h · disc: qa
  - GIVEN el change implementado WHEN se ejecuta la puerta de calidad local THEN todos los comandos terminan con éxito

## Workflow follow-up

- `/opsx:verify`, `/opsx:sync` y `/opsx:archive` tras la implementación.

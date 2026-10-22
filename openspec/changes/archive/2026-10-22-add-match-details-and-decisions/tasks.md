# Tasks

## 1. Dominio y API

- [x] T1 Escribir las pruebas del dominio del match (transiciones de participante y de match, todos confirman, retirada que cierra, 409 fuera de estado) y comprobar que fallan. ref: Confirmar interés · est: 2h · disc: qa
  - GIVEN un match `closed` WHEN se intenta confirmar THEN el dominio lanza `MatchNotOpenError`
- [x] B1 Implementar las transiciones del match y del participante en el dominio y verificar que pasan las pruebas de T1. ref: Retirarse cierra el match para todos · est: 2h · disc: back
  - GIVEN el último participante que confirma WHEN se aplica THEN el match pasa a `confirmed`
- [x] T2 Escribir las pruebas de integración de `getMatch` (participante con dirección descifrada, ajeno 404, admin), `setPhoneSharing` (autorizar y revocar), `confirmMatch` y `withdrawFromMatch`, con sus filas en la matriz, y comprobar que fallan. ref: Detalle del match para sus participantes · est: 4h · disc: qa
  - GIVEN un participante sin autorización WHEN otro consulta el match THEN `phone` es nulo
- [x] B2 Implementar la columna `shares_phone` con su migración, los casos de uso y las rutas, con el descifrado de direcciones restringido a participantes, y verificar que pasan las pruebas de T2. ref: Teléfono solo con autorización · est: 5h · disc: back
  - GIVEN un usuario ajeno WHEN consulta un match THEN la respuesta es 404 y no se descifra ninguna dirección

## 2. App

- [x] T3 Escribir las pruebas de componentes del detalle del match (viviendas, dirección, compensación con aviso, compartir teléfono, confirmar, retirarse con confirmación, estados `confirmed` y `closed`) y comprobar que fallan. ref: Detalle del match para sus participantes · est: 3h · disc: qa
  - GIVEN «Retirarme» pulsado WHEN aparece la confirmación THEN explica que el match se cerrará para todos
- [x] F1 Implementar la pantalla de detalle del match con las acciones y sus estados, y verificar que pasan las pruebas de T3. ref: Confirmar interés · est: 6h · disc: front
  - GIVEN un match confirmado por todos WHEN se abre THEN muestra el estado «Confirmado por todos»

## 3. Integración

- [x] V1 Ejecutar `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage`, `pnpm test:integration` y `pnpm build` y verificar que todo pasa con cobertura ≥ 80 %. ref: Detalle del match para sus participantes · est: 1h · disc: qa
  - GIVEN el change implementado WHEN se ejecuta la puerta de calidad local THEN todos los comandos terminan con éxito

## Workflow follow-up

- `/opsx:verify`, `/opsx:sync` y `/opsx:archive` tras la implementación.

# Tasks

## 1. API

- [ ] T1 Escribir las pruebas de dominio e integración del régimen (VPP sin fecha 400, libre sin datos, valor por encima del máximo legal 422) y comprobar que fallan. ref: Precio máximo legal · est: 2h · disc: qa
  - GIVEN una VPO con máximo legal de 180.000 € WHEN se declara un máximo de 200.000 € THEN la respuesta es 422
- [ ] B1 Implementar las reglas de régimen en el dominio `Home`, el esquema compartido y las restricciones `CHECK` de la migración, y verificar que pasan las pruebas de T1. ref: Régimen de protección · est: 3h · disc: back
  - GIVEN una vivienda libre WHEN se guarda sin datos de protección THEN se acepta

## 2. App

- [ ] T2 Escribir las pruebas de componentes del paso de régimen y del aviso informativo, y comprobar que fallan. ref: Aviso informativo de vivienda protegida · est: 2h · disc: qa
  - GIVEN el detalle de una VPPL WHEN se renderiza THEN aparece el aviso con el precio máximo legal
- [ ] F1 Implementar el paso de régimen en el asistente y el aviso en la ficha y el detalle, y verificar que pasan las pruebas de T2. ref: Régimen de protección · est: 4h · disc: front
  - GIVEN «VPPL» seleccionado WHEN se muestra el paso THEN aparecen los campos de protección

## 3. Integración

- [ ] V1 Ejecutar `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage`, `pnpm test:integration` y `pnpm build` y verificar que todo pasa con cobertura ≥ 80 %. ref: Régimen de protección · est: 1h · disc: qa
  - GIVEN el change implementado WHEN se ejecuta la puerta de calidad local THEN todos los comandos terminan con éxito

## Workflow follow-up

- `/opsx:verify`, `/opsx:sync` y `/opsx:archive` tras la implementación.

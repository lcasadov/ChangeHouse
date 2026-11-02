# Tasks

## 1. Backend

- [ ] T1 Escribir las pruebas de dominio de `submitHome` (completa y nunca rechazada pasa a `published` con fecha de publicación; rechazada pasa a `in_review`; incompleta y con menos de 3 fotos siguen dando 422), de `relevantChangeOf` y `editHome` (publicada o pausada no cambian de estado y anotan la fecha) y de `retireReportedHome` (publicada y pausada pasan a `in_review`; los demás estados no cambian). Comprobar que fallan. ref: Publicación al enviar · est: 2h · disc: qa
  - GIVEN una vivienda en `draft` completa sin motivo de rechazo WHEN se envía THEN queda `published` con `publishedAt`
- [ ] B1 Implementar en `domain/home/home.ts` la publicación al enviar, los cambios relevantes sin nueva revisión y `retireReportedHome`, y verificar que pasan las pruebas de T1. ref: Cambios relevantes sin nueva revisión · est: 2h · disc: back
  - GIVEN una vivienda publicada WHEN cambia su rango de valor THEN sigue `published` y se actualiza `relevantChangedAt`
- [ ] T2 Escribir las pruebas de aplicación e integración de la denuncia de una vivienda: la retira a `in_review`, la saca del descubrimiento, guarda la auditoría `home.report_retire` con quien denuncia y no cierra sus matches; si la auditoría falla, ni la denuncia ni la retirada quedan guardadas. Comprobar que fallan. ref: Denunciar · est: 3h · disc: qa
  - GIVEN una vivienda publicada WHEN otro usuario la denuncia THEN pasa a `in_review` y existe la entrada de auditoría
- [ ] B2 Implementar la denuncia y la retirada en una transacción en `report-operations.ts` (`ModerationScope.reports.insert`, acción `home.report_retire`), actualizar `docs/api/openapi.yaml` y verificar que pasan las pruebas de T2 y las de la cola de moderación. ref: Cola de moderación de viviendas · est: 3h · disc: back
  - GIVEN dos viviendas denunciadas en días distintos WHEN un admin abre la cola THEN ve primero la retirada antes

## 2. App

- [ ] T3 Escribir las pruebas de flujo de la app: el botón «Publicar» deja la casa «Publicada»; editar el valor o las fotos de una publicada guarda sin diálogo ni aviso de revisión; la nota de una casa en revisión explica la retirada; la confirmación de denunciar una vivienda dice que se ha retirado. Comprobar que fallan. ref: Publicación al enviar · est: 3h · disc: qa
  - GIVEN una casa en borrador completa WHEN el propietario pulsa «Publicar» THEN el detalle muestra «Publicada»
- [ ] F1 Implementar los textos y el comportamiento de la app (`SubmitAction`, `HomeWizard` sin diálogo de revisión, notas de estado, confirmación de denuncia y el doble `fake-homes`), y verificar que pasan las pruebas de T3. ref: Denunciar · est: 3h · disc: front
  - GIVEN una casa publicada WHEN su propietario cambia el valor THEN se guarda sin pedir confirmación de revisión

## 3. Datos de prueba, E2E y documentación

- [ ] T4 Adaptar los E2E de la app web: el alta termina en `published`, y los que necesitan una vivienda en la cola la consiguen denunciándola (`reportHome` en `e2e/support/api.ts`). ref: Cola de moderación de viviendas · est: 2h · disc: qa
  - GIVEN el asistente completo WHEN el propietario pulsa «Publicar» THEN la API devuelve la vivienda `published`
- [ ] D1 Ajustar `scripts/seed-demo.mjs` y `docs/desarrollo-local.md` a la publicación automática, ejecutar la puerta de calidad completa (lint, typecheck, cobertura, build, integración) y sincronizar el plan. ref: Publicación al enviar · est: 2h · disc: devops
  - GIVEN una base vacía WHEN se ejecuta `pnpm seed:demo` THEN todas las casas de prueba quedan publicadas sin pasar por el administrador

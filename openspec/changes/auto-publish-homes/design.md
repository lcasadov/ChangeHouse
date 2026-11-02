# Design

## Context

Hoy `submitHome` (`services/api/src/domain/home/home.ts`) lleva una vivienda
completa de `draft` a `in_review`, y solo `approveHome`, llamada desde
`adminModerateHome`, la publica. Además, `relevantChangeOf` devuelve a
`in_review` una vivienda publicada o pausada cuando cambia algo relevante.

Denunciar (`createReport` en `report-operations.ts`) solo inserta la denuncia.
No toca la vivienda, que sigue visible hasta que un administrador actúe.

El usuario pide que la publicación sea automática y que la revisión ocurra solo
cuando alguien denuncia.

## Goals / Non-Goals

**Goals:**

- Que una vivienda completa se publique al enviarla.
- Que una denuncia retire la vivienda de forma inmediata y la ponga en la cola.
- Que la moderación existente (aprobar o rechazar con motivo) siga sirviendo, sin
  cambios en el contrato.

**Non-Goals:**

- Umbrales de varias denuncias, reputación de quien denuncia o retirada temporal
  con caducidad.
- Cerrar automáticamente las denuncias abiertas al moderar la vivienda.
- Cambios de esquema o de estados: `HomeStatus` se queda como está.

## Decisions

### D1. `submitHome` publica o encola según el historial

`submitHome` aplica las mismas comprobaciones que hoy. Si todo está en orden:

- Con `moderationNote === null` (nunca rechazada, o aprobada después), devuelve
  `status: 'published'`, `publishedAt: now` y `submittedAt: now`.
- Con un motivo de rechazo pendiente, devuelve `in_review`. Así no basta con
  reenviar sin cambios para saltarse un rechazo.

Alternativa descartada: publicar siempre, incluida una vivienda rechazada. Haría
inútil el rechazo.

### D2. Los cambios relevantes ya no devuelven a revisión

`relevantChangeOf` deja de usar `RESUBMIT_ON_CHANGE`. Una vivienda publicada o
pausada solo anota `relevantChangedAt`, lo que reactiva los descartes (RF-44).

La app retira de `HomeWizard` el diálogo de confirmación y el aviso de fotos, y
también `home-relevance.ts`, que solo servía para eso.

### D3. La denuncia y la retirada van en una transacción

`createReport` sigue validando antes de escribir. Para una vivienda, ejecuta en
`deps.units.run` estos pasos:

1. `scope.reports.insert(report)`.
2. `scope.homes.findByIdForUpdate(homeId)`.
3. `retireReportedHome(home, now)`, función de dominio nueva. Lleva una vivienda
   `published` o `paused` a `in_review` con `submittedAt: now`; en cualquier
   otro estado devuelve la vivienda sin cambios.
4. `save`.
5. `scope.audit.record`, con la acción `home.report_retire` y quien denuncia como
   actor.

La auditoría solo se escribe si el estado cambió.

Las denuncias de usuarios y de mensajes siguen insertándose como hasta ahora.
Hace falta que `ModerationScope.reports` exponga `insert`, que ya está en
`ReportRepository`.

### D4. Los matches no se tocan

Una vivienda en `in_review` deja de salir en el descubrimiento y de formar
matches nuevos, porque ambos filtran por `published`. Sus matches abiertos
siguen como cuando volvía a revisión por un cambio.

Así, una denuncia malintencionada no puede romper una operación en curso.

### D5. Textos de la app

| Texto | Antes | Ahora |
|---|---|---|
| Botón de envío (`homes.submit.action` y `homes.actions.submit`) | «Enviar a revisión» | «Publicar» |
| Faltan datos (`homes.submit.missing`) | Hablaba de revisión | «Faltan datos para publicar tu casa: …» |
| Nota de borrador | Hablaba de enviarla a revisión | Pide publicarla |
| Nota de `in_review` | Genérica | Explica que no aparece en Explorar mientras se revisa y que los matches siguen abiertos |
| Confirmación de denuncia (`report.sent`) | Genérica | Para una vivienda, dice que se ha retirado mientras se revisa |

### D6. Seed y E2E

`seed-demo.mjs` ya tolera que la vivienda salga publicada, porque solo modera si
la encuentra en `in_review`.

Los E2E que necesitan una vivienda en la cola la consiguen denunciándola desde
otra cuenta. `e2e/support/api.ts` ofrece `reportHome`.

## Risks / Trade-offs

- **Denuncias abusivas.** Una sola denuncia retira la casa. Lo mitigan el límite
  de denuncias por usuario y hora que ya existe, que la retirada no cierre
  matches y que quede auditada con quien denunció, lo que permite suspenderle.
- **Contenido inadecuado visible hasta la primera denuncia.** Es el precio de
  publicar sin cola, y lo pide el usuario.

## Migration Plan

No hay migración de datos. Las viviendas que ya estén en `in_review` siguen en la
cola. Para volver atrás basta con revertir el código.

## Open Questions

- ¿Debe cerrarse la denuncia al aprobar o rechazar la vivienda? Decisión
  recomendada: no por ahora. El administrador la resuelve aparte en la revisión
  de denuncias, como hoy.

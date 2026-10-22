# Design

## Context

Hay roles asignados y auditoría (`add-home-moderation`), autenticación
centralizada en la API (`add-authentication`), y descubrimiento y matching que
ya excluyen viviendas no publicadas. El contrato declara
`adminSetUserSuspension` y el código `ACCOUNT_SUSPENDED`. Motivación en
`proposal.md`.

## Decisions

- **Estado en `users`**: `suspended_at` y `suspension_reason`; suspender y
  reactivar se auditan en la misma transacción. Un admin no puede suspenderse
  a sí mismo (409) ni suspender a otro admin sin quitarle antes el rol (409).
- **Bloqueo centralizado**: el *hook* de autenticación de la API carga el
  estado del usuario y responde 403 `ACCOUNT_SUSPENDED` en toda operación
  salvo `getMe` (para que la app muestre la pantalla) y `exportMyData`.
- **Efectos**: al suspender, sus matches abiertos o confirmados se cierran
  para todos (participante `withdrawn`, auditoría) y sus viviendas dejan de
  aparecer: el descubrimiento y la detección de ciclos excluyen propietarios
  suspendidos. Al reactivar, sus viviendas vuelven a aparecer; los matches
  cerrados no se reabren.
- **App**: si la API responde `ACCOUNT_SUSPENDED` o `getMe` indica cuenta
  suspendida, pantalla dedicada con el motivo general y el contacto, más
  «Descargar mis datos» y «Cerrar sesión». En «Administración», la ficha del
  usuario ofrece «Suspender» con motivo obligatorio y «Reactivar».

## Risks / Trade-offs

- [Consultar el estado en cada petición] → lectura por clave primaria que ya
  se hace al resolver el usuario.

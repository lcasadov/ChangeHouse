# Design

## Context

`homes` ya tiene `regime`, `vpp_qualification_date`, `vpp_protection_end` y
`vpp_max_legal_price_cents`, con las restricciones del modelo de datos (RN-06);
el descubrimiento ya oculta las VPP a quien no declara cumplir los requisitos.
Falta que el alta y la edición los pidan y validen, y el aviso informativo.
Motivación en `proposal.md`.

## Decisions

- **Validación en el dominio `Home`**: régimen protegido (`VPPB`, `VPPL`,
  `VPO`) exige fecha de calificación al enviar a revisión (en borrador se
  admite vacía) y `value_max_cents ≤ vpp_max_legal_price_cents` cuando se
  conoce (422 con el campo). Las restricciones de la base quedan como red de
  seguridad.
- **Contrato**: los campos ya existen en `Home`; se documentan los nuevos
  códigos de validación. Sin operaciones nuevas.
- **Declaración del usuario**: `meets_vpp_requirements` se edita en el perfil
  (`updateMe`) con una explicación; si el contrato no lo expone aún, se añade
  al esquema del perfil.
- **App**: paso «Régimen» en el asistente tras «Datos básicos», con selector
  de cuatro opciones y, si es protegida, fechas y precio máximo legal; el
  importe máximo del rango muestra el tope legal. Aviso informativo en la
  ficha del propietario y en el detalle público: precio máximo, necesidad de
  visado o autorización y requisitos del adquirente, con «Tanteo y retracto en
  permutas: pendiente de confirmar».

## Risks / Trade-offs

- [Normativa autonómica distinta] → el aviso es genérico y orientativo; no se
  calcula el precio máximo.

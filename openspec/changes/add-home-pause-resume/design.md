# Design

## Context

`homes` tiene los estados `published` y `paused`; el descubrimiento y la
detección de ciclos solo consideran `published`; el rol `owner` se deriva de
tener una vivienda publicada, pausada o en operación (`add-home-listing`).
`updateHome` ya marca `relevant_changed_at` al cambiar el rango de valor o las
fotos (`add-discovery-feed`). El contrato declara `pauseHome` y `resumeHome`.
Motivación en `proposal.md`.

## Decisions

- **Dominio**: `pauseHome` (`published → paused`) y `resumeHome`
  (`paused → published`); otros estados → `conflict` (409). Reactivar no pasa
  por moderación si no hubo cambios relevantes mientras estaba pausada.
- **Cambios relevantes**: lista explícita en el dominio — rango de valor,
  fotos, tipo, superficies, dormitorios, baños, planta, ascensor, garaje,
  trastero, características, régimen y fechas VPP. Editar cualquiera en una
  vivienda `published` o `paused` la lleva a `in_review` y fija `submitted_at`
  y `relevant_changed_at`; `location_visibility` y `area_name` no son
  relevantes. Una vivienda que vuelve a revisión deja de aparecer en el
  descubrimiento; sus matches abiertos se conservan.
- **Matches**: pausar no cierra matches abiertos; la detección de ciclos ya
  exige `published`, así que no se forman nuevos.
- **App**: en el detalle de una vivienda publicada, «Pausar» con la
  explicación «No aparecerá en Explorar ni hará matches nuevos; tus matches
  siguen abiertos», y «Reactivar» en las pausadas; al editar datos relevantes
  de una publicada, aviso previo «Volverá a revisión antes de mostrarse». Esto
  resuelve la decisión abierta de `add-home-listing` sobre editar viviendas
  publicadas.

## Risks / Trade-offs

- [Pausar para esquivar la moderación] → los cambios relevantes durante la
  pausa también la devuelven a revisión.

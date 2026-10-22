# Design

## Context

La sección «Administración» existe con la cola de moderación
(`add-home-moderation`), las denuncias (`add-reports-and-blocking`) y la
suspensión (`add-user-suspension`). El contrato declara `adminGetMetrics`,
`adminListUsers`, `adminListAuditLog` y `adminListWaitlist`. Motivación en
`proposal.md`.

## Decisions

- **Métricas** (`adminGetMetrics?from&to`): consultas agregadas sobre
  `users.created_at`, `homes.published_at` agrupadas por `municipality` (o
  `area_name` si falta), `likes.created_at`, `matches` por `type` y
  operaciones; periodo en días naturales de Madrid, `to < from` → 400 con el
  campo. Sin tablas nuevas; índices por fecha ya existentes o añadidos.
- **Usuarios** (`adminListUsers?q`): búsqueda por prefijo de email o nombre
  visible sin distinguir mayúsculas ni tildes, cursor y estado (activo o
  suspendido).
- **Auditoría** (`adminListAuditLog`): del más reciente al más antiguo, con
  cursor; solo lectura.
- **Lista de espera** (`adminListWaitlist?municipality`): JSON paginado o CSV
  con `Accept: text/csv` (email, municipio, tipo de vivienda, qué busca, fecha
  de consentimiento), con escape de fórmulas (`=`, `+`, `-`, `@`) para evitar
  inyección en hojas de cálculo.
- **App**: «Administración» pasa a tener pestañas superiores: Moderación,
  Denuncias, Usuarios, Métricas, Auditoría y Lista de espera. Métricas con
  tarjetas de totales y una lista por zona; tablas que en pantallas
  estrechas se convierten en tarjetas sin desplazamiento horizontal;
  «Exportar CSV» descarga en web y comparte en móvil.

## Risks / Trade-offs

- [Agregados lentos con volumen] → periodo máximo de 366 días y prueba con
  datos sintéticos.

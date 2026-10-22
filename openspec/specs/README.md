# Specs consolidados de ChangeHouse

Capacidades implementadas. Cada una se crea o amplía al archivar un change
(`openspec archive`); su estado y sus changes están en `openspec/PLAN.md`.

| Capacidad | Qué cubre | Change que la creó |
|---|---|---|
| [`landing`](landing/spec.md) | Web pública: propuesta de valor, páginas legales, consentimiento de cookies, accesibilidad y SEO | `2026-10-19-add-landing` |
| [`waitlist`](waitlist/spec.md) | Alta en la lista de espera con consentimiento, sin revelar inscripciones previas y con límite de peticiones | `2026-10-19-add-waitlist` |
| [`api-errors`](api-errors/spec.md) | Formato único de error de la API (`Problem`) con identificador de correlación | `2026-10-19-add-waitlist` |
| [`accounts`](accounts/spec.md) | Registro, acceso, verificación del email, recuperación de la contraseña, alta con consentimiento | `2026-10-19-add-authentication` |
| [`authorization`](authorization/spec.md) | Autenticación de las peticiones, roles derivados y asignados, denegación por defecto | `2026-10-19-add-authentication` |
| [`homes`](homes/spec.md) | Alta en borrador con asistente, fotos sin metadatos (de 3 a 20), régimen de protección con tope legal, varias viviendas por usuario, dirección privada y ubicación por zona o exacta, envío a revisión, vistas según quién consulta y rol de propietario derivado | `2026-10-19-add-home-listing` (ampliado por `add-home-photos` y `add-home-vpp-regime`) |
| [`moderation`](moderation/spec.md) | Cola de revisión de viviendas solo para `admin`, aprobación o rechazo con motivo visible para el propietario y auditoría de solo inserción en la misma transacción | `2026-10-19-add-home-moderation` |
| [`search-preferences`](search-preferences/spec.md) | Preferencias por defecto del usuario y propias de cada vivienda (zonas por municipio o radio, filtros, compensación y punto del rango) y búsqueda en un toque con primer uso | `2026-10-19-add-search-preferences` |
| [`discovery`](discovery/spec.md) | Me gusta, descartar y deshacer con gesto y límite diario; tarjetas de viviendas compatibles en los dos sentidos con compensación estimada, exclusiones (propias, no publicadas, descartadas, VPP) y modo sin vivienda publicada | `2026-10-19-add-discovery-feed` (ampliado por `add-like-dismiss-undo`) |
| [`matching`](matching/spec.md) | Match directo detectado en la transacción del me gusta, un solo match por ciclo, compensaciones de suma cero, lista de matches y celebración | `2026-10-22-add-direct-match` |
| [`matches`](matches/spec.md) | Detalle del match solo para participantes con dirección exacta, teléfono autorizado por match, confirmar interés y retirarse que cierra para todos | `2026-10-22-add-match-details-and-decisions` |

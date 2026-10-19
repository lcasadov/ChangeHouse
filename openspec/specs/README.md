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
| [`homes`](homes/spec.md) | Alta en borrador con asistente, varias viviendas por usuario, dirección privada y ubicación por zona o exacta, envío a revisión, vistas según quién consulta y rol de propietario derivado | `2026-10-19-add-home-listing` |

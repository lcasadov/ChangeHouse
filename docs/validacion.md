# ChangeHouse — Validación de la documentación

> Generado por `/harness:14-validate-docs` el 2026-10-18 sobre `docs/project.md`,
> `product.md`, `architecture.md`, `datamodel.md`, `api/openapi.yaml`,
> `rbac-matrix.md`, `TESTING-STRATEGY.md`, `code-standards.md`,
> `style-guide.md`, `backlog.md` y `openspec/`.
>
> **No se ha corregido nada**: cada problema espera una decisión. Comprobaciones
> mecánicas que **sí** cuadran: las 38 operaciones de la API aparecen en la
> tabla de correspondencia de la matriz RBAC; no hay Given/When/Then en el
> backlog; `openspec/specs/` está vacío, lo esperado sin código.

Resumen: 🔴 2 · 🟠 9 · 🟡 11 · 🔵 3 — **25 problemas**.

**Estado tras la ronda del 2026-10-18**: 20 resueltos, 1 parcial (23, dominio) y 4 pendientes o en curso (1 Node 24 y scaffold, 18 tipografía, 20 datos de categoría especial, 25 tras el scaffold). Además: preferencias de búsqueda por usuario con sustitución por vivienda.

---

### Problema 1 de 25

- **Tipo**: Laguna
- **Gravedad**: 🔴 bloqueante
- **Ubicación**: `docs/project.md` §0, §3, §4, §5 (comandos)
- **Descripción**: todos los comandos (`pnpm install`, `lint`, `typecheck`, `test`, `test:coverage`, `build`, `db:migrate`) son `⚠️ SUPUESTO`: no existe el monorepo y en esta máquina **no está instalado pnpm** y Node es la 22 (el contrato declara Node 24 LTS). Ningún agente puede cerrar una tarea sin ejecutarlos (`static-analysis`).
- **Solución propuesta**: ejecutar el habilitador T-01 (scaffold) como primer change, instalar Node 24 y pnpm (`corepack enable`), y confirmar los comandos en el contrato.
- **Estado**: en curso — pnpm 10 instalado; falta Node 24 (lo instala el usuario) y el scaffold T-01, siguiente change

### Problema 2 de 25

- **Tipo**: Laguna
- **Gravedad**: 🔴 bloqueante
- **Ubicación**: `docs/project.md` §5 (`$TEST_INTEGRATION_CMD`, `$TEST_E2E_CMD`) ↔ `docs/TESTING-STRATEGY.md` §7
- **Descripción**: los comandos de integración y E2E están `⚠️ PENDIENTE`; la estrategia exige integración con Testcontainers en cada PR. Sin comando, el agente `tester` no puede ejecutarlas.
- **Solución propuesta**: fijar `pnpm test:integration` y `pnpm test:e2e` (recomendación de la estrategia) al crear el scaffold.
- **Estado**: resuelto (2026-10-18) — `pnpm test:integration` y `pnpm test:e2e`

### Problema 3 de 25

- **Tipo**: Incoherencia
- **Gravedad**: 🟠 alta
- **Ubicación**: `docs/datamodel.md` §2 `users.role` ↔ `docs/rbac-matrix.md` §1
- **Descripción**: el modelo guarda un único `role` (`propietario`, `buscador`, `gestoria`, `admin`); la matriz decide que `propietario` y `buscador` son **derivados** y solo `gestoria` y `admin` se asignan. La API ya sigue la matriz (`roles[]` + `hasPublishedHome`).
- **Solución propuesta**: en el modelo, sustituir `role` por `assigned_role` (`gestoria` | `admin` | nulo) y cerrar el riesgo R-4.
- **Estado**: resuelto (2026-10-18) — `assigned_role` (`agency`, `admin`); `owner`/`seeker` derivados; roles en inglés

### Problema 4 de 25

- **Tipo**: Incoherencia
- **Gravedad**: 🟠 alta
- **Ubicación**: `docs/api/openapi.yaml` (`blockUser`, `setPhoneSharing`, `registerDevice`, `adminSetUserSuspension`) ↔ `docs/datamodel.md`
- **Descripción**: cuatro operaciones del contrato no tienen dónde guardar sus datos: bloqueos entre usuarios, autorización para compartir el teléfono por match, tokens FCM de dispositivos y suspensión de usuarios.
- **Solución propuesta**: añadir al modelo `user_blocks (blocker_id, blocked_id, created_at)`, `match_participants.shares_phone boolean`, `user_devices (user_id, fcm_token, platform, updated_at)` y `users.suspended_at` + `suspension_reason`.
- **Estado**: resuelto (2026-10-18) — `user_blocks`, `user_devices`, `match_participants.shares_phone`, `users.suspended_at`

### Problema 5 de 25

- **Tipo**: Incoherencia
- **Gravedad**: 🟠 alta
- **Ubicación**: `docs/api/openapi.yaml` (`Match.chatId`, `Home.moderationNote`, `Report.resolution`, `ReportStatus`) ↔ `docs/datamodel.md`
- **Descripción**: campos de la API sin columna en el modelo: id del chat en Firestore, motivo del último rechazo de moderación, resolución de la denuncia y los estados de la denuncia (`open`, `resolved`, `dismissed`) que el modelo no enumera.
- **Solución propuesta**: añadir `matches.chat_id`, `homes.moderation_note`, `reports.resolution`, `reports.created_at` y el enum `report_status`.
- **Estado**: resuelto (2026-10-18) — `matches.chat_id`, `homes.moderation_note`, `reports.resolution`/`created_at`/`status`

### Problema 6 de 25

- **Tipo**: Incoherencia
- **Gravedad**: 🟠 alta
- **Ubicación**: `docs/backlog.md` (lista de espera: «exportación para el equipo incluida») y `docs/rbac-matrix.md` §2 (admin «C» sobre lista de espera) ↔ `docs/api/openapi.yaml`
- **Descripción**: la consulta o exportación de la lista de espera por el admin no tiene operación en el contrato.
- **Solución propuesta**: añadir `GET /admin/waitlist` (admin, paginado, exportable) **o** quitarla del backlog y de la matriz y exportar desde la consola de base de datos. Requiere confirmación (regla: no inventar endpoints).
- **Estado**: resuelto (2026-10-18) — añadido `GET /admin/waitlist` (JSON y CSV)

### Problema 7 de 25

- **Tipo**: Ambigüedad
- **Gravedad**: 🟠 alta
- **Ubicación**: `docs/backlog.md` (Matches > Decisión) ↔ `docs/api/openapi.yaml` (`MatchStatus.confirmed`) ↔ README RF-80 (fase 2)
- **Descripción**: en el MVP no hay operación con gestoría; no está definido qué ocurre cuando **todos** confirman: ¿el match queda `confirmed` y los participantes siguen por su cuenta?, ¿se pausan los demás matches de esas viviendas (RF-55)? Decisión de negocio.
- **Solución propuesta**: decide el responsable de producto. Opción por defecto: `confirmed` sin pausar otros matches hasta la fase 2.
- **Estado**: resuelto (2026-10-18) — queda `confirmed` sin pausar los demás matches hasta la fase 2

### Problema 8 de 25

- **Tipo**: Laguna
- **Gravedad**: 🟠 alta
- **Ubicación**: `docs/project.md` §4 `$I18N` y `$HTTP_CLIENT`
- **Descripción**: sin librería de i18n ni cliente HTTP, el agente `frontend` no puede cumplir la regla 9 (todo texto por i18n) ni saber cómo llamar a la API.
- **Solución propuesta**: i18n con `i18next` + `react-i18next` + `expo-localization`, recursos en `apps/mobile/src/i18n/locales/<idioma>.json`; cliente HTTP `fetch` nativo envuelto en un cliente tipado generado desde OpenAPI (p. ej. `openapi-fetch`). Requiere confirmación.
- **Estado**: resuelto (2026-10-18) — `i18next` + `react-i18next` + `expo-localization`; `openapi-fetch` tipado

### Problema 9 de 25

- **Tipo**: Laguna
- **Gravedad**: 🟠 alta
- **Ubicación**: README §16 (email transaccional) ↔ `docs/architecture.md` (adaptador `Mailer`) ↔ `docs/backlog.md` (lista de espera, avisos)
- **Descripción**: sin proveedor de email no se pueden implementar la confirmación de la lista de espera ni RF-62.
- **Solución propuesta**: decide el responsable: Resend, SendGrid o la extensión de Firebase. Criterio: región UE y contrato de encargado de tratamiento.
- **Estado**: resuelto (2026-10-18) — extensión Trigger Email de Firebase con SMTP de Gmail (cuenta y contraseña de aplicación las crea el responsable; provisional hasta tener dominio)

### Problema 10 de 25

- **Tipo**: Laguna
- **Gravedad**: 🟠 alta
- **Ubicación**: `docs/project.md` §6 `$LOG_RETENTION`; `docs/datamodel.md` §5 (lista de espera, auditoría); `docs/backlog.md` (chat)
- **Descripción**: sin plazos de conservación de la auditoría, la lista de espera y los mensajes de chat no puede cumplirse el RGPD (limitación del plazo) ni diseñar las purgas.
- **Solución propuesta**: decide el responsable con asesoría legal. Referencia habitual: auditoría 2 años; lista de espera hasta el lanzamiento + 12 meses o baja; chat mientras exista el match + 12 meses.
- **Estado**: resuelto (2026-10-18) — auditoría 2 años; lista de espera lanzamiento + 12 meses o baja; chat match + 12 meses

### Problema 11 de 25

- **Tipo**: Laguna
- **Gravedad**: 🟠 alta
- **Ubicación**: `.claude/harness/profile/quality-gates.md` y `$QUALITY_GATE` (`project.partial.md`, `docs/project.md`)
- **Descripción**: hallazgos aplazados de CodeRabbit (issue #4): los comandos de verificación tienen un `\n` literal que los rompe, y `$QUALITY_GATE` no exige que la revisión de CodeRabbit sobre el HEAD esté en `APPROVED` o `COMMENTED`.
- **Solución propuesta**: aplicar las dos correcciones en el issue #4.
- **Estado**: resuelto (2026-10-18) — corregidos los comandos y `$QUALITY_GATE` (issue #4)

### Problema 12 de 25

- **Tipo**: Ambigüedad
- **Gravedad**: 🟡 media
- **Ubicación**: `docs/api/openapi.yaml` (`createHome` 409) y `docs/rbac-matrix.md` §3 ↔ README RF-20 (prioridad C)
- **Descripción**: los documentos asumen **una vivienda por usuario en el MVP**, deducido de que RF-20 (varias viviendas) es de fase 3. No está escrito en el README.
- **Solución propuesta**: confirmar la restricción.
- **Estado**: resuelto (2026-10-18) — **varias viviendas por usuario** en el MVP (RF-20 pasa a M); el me gusta se emite desde una vivienda concreta (`fromHomeId`)

### Problema 13 de 25

- **Tipo**: Laguna
- **Gravedad**: 🟡 media
- **Ubicación**: `docs/api/openapi.yaml` `HomeType`, `features`, `ConsentType`; `docs/datamodel.md` `homes.type`
- **Descripción**: listas abiertas: tipos de vivienda («piso, ático, dúplex, chalet, adosado…»), claves de `features` y tipos de consentimiento.
- **Solución propuesta**: cerrar las listas con el responsable de producto antes del change de viviendas.
- **Estado**: resuelto (2026-10-18) — listas cerradas aceptadas

### Problema 14 de 25

- **Tipo**: Laguna
- **Gravedad**: 🟡 media
- **Ubicación**: `docs/datamodel.md` R-1 ↔ `docs/api/openapi.yaml` (`*Cents`) ↔ `docs/code-standards.md` (dinero)
- **Descripción**: el tipo de los importes (céntimos en `bigint`) es un supuesto, aunque ya lo usan la API y los estándares.
- **Solución propuesta**: confirmar `bigint` en céntimos.
- **Estado**: resuelto (2026-10-18) — `bigint` en céntimos

### Problema 15 de 25

- **Tipo**: Laguna
- **Gravedad**: 🟡 media
- **Ubicación**: `docs/datamodel.md` R-5 ↔ `docs/api/openapi.yaml` `discoverHomes` ↔ RF-44
- **Descripción**: RF-44 vuelve a mostrar un descarte si la vivienda «cambia de forma relevante», pero el modelo no guarda qué versión se descartó ni qué cambio es relevante.
- **Solución propuesta**: `homes.relevant_changed_at` actualizado al cambiar valor o fotos, y `dismissals.dismissed_at` comparado con él. Confirmar qué cambios cuentan.
- **Estado**: resuelto (2026-10-18) — `homes.relevant_changed_at` aceptado

### Problema 16 de 25

- **Tipo**: Ambigüedad
- **Gravedad**: 🟡 media
- **Ubicación**: `docs/code-standards.md` §2 ↔ README §4 ↔ `docs/api/openapi.yaml` `Role`
- **Descripción**: los roles están en español (`propietario`, `buscador`, `gestoria`) y el resto de enumerados en inglés.
- **Solución propuesta**: o todo en inglés en código (`owner`, `seeker`, `agency`, `admin`) con traducción en la interfaz, o mantener el español solo en roles. Recomendación: todo en inglés.
- **Estado**: resuelto (2026-10-18) — todo en inglés en código: `visitor`, `seeker`, `owner`, `agency`, `admin`

### Problema 17 de 25

- **Tipo**: Ambigüedad
- **Gravedad**: 🟡 media
- **Ubicación**: `docs/datamodel.md` `homes.approx_location` ↔ `docs/api/openapi.yaml` `HomePublic.approxLocation` ↔ RF-13
- **Descripción**: no está decidido cómo se aproxima la ubicación (centroide de barrio, celda de rejilla, desplazamiento aleatorio fijo). Afecta a la privacidad (reidentificación del portal).
- **Solución propuesta**: celda de rejilla fija (p. ej. ~300 m) o barrio; nunca desplazamiento aleatorio recalculado, que se promedia.
- **Estado**: resuelto (2026-10-18) — el propietario elige: ubicación exacta pública (`exact`) o barrio o zona (`area`, por defecto)

### Problema 18 de 25

- **Tipo**: Laguna
- **Gravedad**: 🟡 media
- **Ubicación**: `docs/style-guide.md` §1 (tipografía)
- **Descripción**: familia tipográfica pendiente (las plantillas Word usan Calibri, no disponible libremente en la app).
- **Solución propuesta**: Inter con respaldo de la fuente del sistema.
- **Estado**: pendiente — explicación de Inter enviada al usuario

### Problema 19 de 25

- **Tipo**: Ambigüedad
- **Gravedad**: 🟡 media
- **Ubicación**: `docs/rbac-matrix.md` §1 (exclusividad de roles) y §3 (bloqueos, suspendidos)
- **Descripción**: tres supuestos de la matriz sin confirmar: admin y gestoría no pueden publicar ni dar me gusta; el bloqueo oculta mutuamente en descubrimiento e impide matches; un suspendido solo puede exportar sus datos.
- **Solución propuesta**: confirmar los tres.
- **Estado**: resuelto (2026-10-18) — exclusividad, alcance del bloqueo y de la suspensión confirmados

### Problema 20 de 25

- **Tipo**: Laguna
- **Gravedad**: 🟡 media
- **Ubicación**: `docs/project.md` §6 `$DATOS_CATEGORIA_ESPECIAL`
- **Descripción**: supuesto de que no hay datos del art. 9 RGPD en el MVP; condiciona el rigor de la auditoría de seguridad y la EIPD.
- **Solución propuesta**: confirmar con asesoría legal.
- **Estado**: pendiente — aclaración enviada al usuario

### Problema 21 de 25

- **Tipo**: Ambigüedad
- **Gravedad**: 🟡 media
- **Ubicación**: `docs/backlog.md` (límite diario, punto medio) ↔ README RF-45, RN-03
- **Descripción**: valor del límite diario de likes y si el punto medio del rango de valor es global o por usuario.
- **Solución propuesta**: decide producto. Propuesta: límite configurable por entorno (valor inicial a decidir) y punto medio global.
- **Estado**: resuelto (2026-10-18) — punto del rango por usuario; límite de 10 likes por usuario y día, configurable por entorno

### Problema 22 de 25

- **Tipo**: Ambigüedad
- **Gravedad**: 🟡 media
- **Ubicación**: `docs/api/openapi.yaml` `Metrics.publishedHomesByZone` ↔ RF-91
- **Descripción**: «zona» no está definida (municipio, distrito, código postal).
- **Solución propuesta**: municipio en el MVP.
- **Estado**: resuelto (2026-10-18) — zona = barrio o zona de la vivienda (`areaName`)

### Problema 23 de 25

- **Tipo**: Laguna
- **Gravedad**: 🔵 baja
- **Ubicación**: `docs/api/openapi.yaml` `servers` ↔ `docs/project.md`
- **Descripción**: dominios de DES y PROD sin decidir (se usan marcadores `changehouse.example`).
- **Solución propuesta**: decidir el dominio (comprobar disponibilidad y marca de «ChangeHouse»).
- **Estado**: parcial (2026-10-18) — elegido changehouse.com, pero está registrado por un tercero desde 1999 (vence el 17/12/2026); hay que comprarlo al titular o elegir otro

### Problema 24 de 25

- **Tipo**: Laguna
- **Gravedad**: 🔵 baja
- **Ubicación**: repositorio público sin licencia; `docs/api/openapi.yaml` `info.license`
- **Descripción**: el repositorio es público y no declara licencia: por defecto, todos los derechos reservados, pero sin aviso explícito.
- **Solución propuesta**: decidir: licencia propietaria explícita («All rights reserved») o una abierta.
- **Estado**: resuelto (2026-10-18) — `LICENSE` con todos los derechos reservados

### Problema 25 de 25

- **Tipo**: Laguna
- **Gravedad**: 🔵 baja
- **Ubicación**: `.claude/rules/*.md` (`paths`)
- **Descripción**: los patrones de `paths` ya apuntan a la estructura declarada, pero no casan con ningún fichero porque aún no hay código. Esperado; se revisa tras el scaffold.
- **Solución propuesta**: repetir el prompt 15 tras T-01.
- **Estado**: pendiente — tras el scaffold

# ChangeHouse — Matriz de roles y permisos

> `$RBAC_MATRIX_DOC`. Fuentes: `docs/project.md` (`$ACCESS_SEGREGATION_MODEL`,
> `$AUTH_MECHANISM`, `$NORMATIVA`), `docs/product.md` y `docs/api/openapi.yaml`.
> Aún no hay código de autorización: este documento define lo que **debe**
> ser. Alcance: MVP; la fase 2 (gestorías, operaciones, pagos) se marca aparte.

**Principio rector: denegación por defecto.** Lo que no figura como permitido
está prohibido. Toda la autorización se evalúa en la API, en un único punto
(hook de autenticación de Fastify + política por caso de uso). Lo que la app
oculta es comodidad, no control de acceso.

---

## 1 · Catálogo de roles

| Rol técnico | Tipo | Descripción | Perfil |
|---|---|---|---|
| `visitor` | implícito (sin token) | Navega la landing y se apunta a la lista de espera | Cualquier persona |
| `seeker` | **derivado** | Usuario registrado **sin** vivienda publicada: mira, no genera matches | Particular que aún no ha publicado |
| `owner` | **derivado** | Usuario registrado con al menos una vivienda `published`, `paused` o `in_operation` | Particular que quiere permutar |
| `agency` | asignado (fase 2) | Profesional de una gestoría asociada; ve y tramita las operaciones asignadas | Gestoría |
| `admin` | asignado | Equipo ChangeHouse: moderación, verificación, soporte, métricas | Equipo interno |

**Roles derivados frente a asignados** (decisión de este documento, ver
`docs/datamodel.md` R-4): `owner` y `seeker` **no se guardan**; se
calculan en cada petición a partir de las viviendas del usuario. Así un usuario
pasa de `seeker` a `owner` al publicar sin que nadie le cambie el rol.
`agency` y `admin` se asignan y se guardan como *custom claims* de Firebase
**y** en la base de datos; la API usa la base de datos como fuente de verdad.

**Acumulación**: `owner` y `seeker` son **exclusivos** entre sí. `admin`
y `agency` son **exclusivos** con los demás: una cuenta de admin o de gestoría
no publica viviendas ni da likes (segregación de funciones). Confirmado el 2026-10-18.

Calificadores contextuales que se combinan con el rol:

| Calificador | Significa |
|---|---|
| `resourceOwner` | Es el propietario del recurso (vivienda, foto) |
| `participant` | Su vivienda forma parte del match |
| `assigned` | La operación está asignada a su gestoría (fase 2) |
| `self` | El recurso es su propia cuenta |

## 2 · Matriz principal

Celda vacía = **denegado**. C consultar · A crear · M modificar · E eliminar.

| Recurso | visitor | seeker | owner | admin | agency (fase 2) |
|---|---|---|---|---|---|
| Propia cuenta (`/me`) | | C A M E ¹ | C A M E ¹ | C M | C M |
| Exportación de datos propios | | C | C | | C |
| Consentimientos propios | | C A | C A | C A | C A |
| Vivienda propia | | C A M ² | C A M ² | | |
| Vivienda ajena publicada (forma pública) | | C | C | C | |
| Vivienda ajena no publicada | | | | C | |
| Dirección postal exacta ajena | | | C ³ | C ⁴ | C ⁵ |
| Ubicación exacta ajena en el mapa | | C ¹⁰ | C ¹⁰ ³ | C | |
| Fotos de vivienda propia | | A E ² | A E ² | | |
| Preferencias de búsqueda propias (por defecto) | | C M | C M | | |
| Preferencias de una vivienda propia | | C M E | C M E | | |
| Descubrimiento | | C | C | | |
| Me gusta | | | A ⁶ | | |
| Descartar / deshacer | | A E | A E | | |
| Match | | | C ³ confirmar ³ retirarse ³ | C | |
| Teléfono de otro participante | | | C ⁷ | | |
| Chat de un match (Firestore) | | | C A ³ | C ⁸ | |
| Denuncia | | A | A | C M | |
| Bloqueo de usuario | | A | A | | |
| Moderación de viviendas | | | | C aprobar rechazar | |
| Usuarios (panel) | | | | C suspender | |
| Métricas | | | | C | |
| Log de auditoría | | | | C | |
| Lista de espera | A | | | C exportar ⁹ | |
| Operación (fase 2) | | | C ³ | C | C M ⁵ |
| Documentos de operación (fase 2) | | | C A ³ | | C A ⁵ |
| Gestorías (fase 2) | | | | C A M | |

1. Eliminar cuenta: no permitido si tiene una operación en curso (fase 2).
2. Solo en estados que lo permiten (ver §3 «Estado»).
3. Solo si es `participant` del match o la operación.
4. Solo para moderación y soporte, y queda registrado en `audit_log`.
5. Solo si la operación está `assigned` a su gestoría.
6. Solo si tiene vivienda `published` y no ha superado el límite diario de 10 likes (RF-45, configurable por entorno).
7. Solo si ese participante ha autorizado compartirlo (RF-53).
8. Solo mensajes denunciados, para moderación.
9. Exportación para contacto, con el consentimiento registrado.
10. Si el propietario eligió ubicación exacta (`exact`); si eligió `area`, solo el barrio o zona, salvo para participantes de un match.

## 3 · Reglas contextuales

**Propiedad y participación**

- Un usuario solo modifica viviendas cuyo `owner_id` es su `id`.
- Un usuario solo ve un match, su chat, las direcciones exactas y las
  compensaciones si una de sus viviendas es participante.
- Un usuario puede tener **varias viviendas** (RF-20). El me gusta se emite
  **desde una vivienda propia y publicada** que el cliente indica
  (`fromHomeId`); la API comprueba que es suya y que está publicada. Cada
  vivienda participa en el matching de forma independiente.

**Estado**

| Operación | Permitida en | Prohibida en |
|---|---|---|
| Modificar vivienda | `draft`, `in_review`, `published`, `paused` | `in_operation`, `closed` |
| Enviar a moderación | `draft` | resto |
| Pausar | `published` | resto |
| Reactivar | `paused` | resto |
| Moderar | `in_review` | resto |
| Confirmar o retirarse de un match | `open` (y participante en `pending`) | resto |
| Deshacer última acción | like que no ha formado match, o descarte | like que ya forma parte de un match |
| Aparecer en descubrimiento | `published` | resto (RN-11) |

**Datos del usuario**

- VPP: una vivienda VPP solo aparece en descubrimiento a usuarios con
  `meets_vpp_requirements = true` (RN-06).
- Usuarios bloqueados: no se muestran mutuamente en descubrimiento ni pueden
  formar match entre sí. Confirmado el 2026-10-18.
- Usuario suspendido o borrado: toda petición autenticada devuelve 403, salvo
  la exportación de datos. Confirmado el 2026-10-18.

**Segregación de funciones**

- Un `admin` no modera viviendas propias (no tiene: ver exclusividad en §1).
- Las acciones de `admin` sobre usuarios, viviendas y denuncias se registran en
  `audit_log` (RF-93).

## 4 · Reglas críticas

Cada regla es una prueba automática. Formato: el rol X **no puede** Y sobre Z.

| ID | Regla |
|---|---|
| RC-01 | Ninguna operación salvo `POST /waitlist` responde con éxito sin un ID token válido de Firebase |
| RC-02 | Un `seeker` no puede dar me gusta (403) |
| RC-03 | Un usuario no puede modificar, enviar, pausar ni reactivar una vivienda ajena (404) |
| RC-04 | Un usuario no puede ver la dirección postal exacta de una vivienda si no participa en un match que la incluya, ni su ubicación exacta si el propietario eligió `area` (no aparece en la respuesta) |
| RC-05 | Un usuario no puede ver un match en el que no participa (404) |
| RC-06 | Un usuario no puede confirmar ni retirarse de un match en el que no participa (404) |
| RC-07 | Un usuario no puede ver una vivienda ajena en `draft`, `in_review`, `paused` ni `closed` (404) |
| RC-08 | Un usuario sin `meets_vpp_requirements` no recibe viviendas VPP en descubrimiento |
| RC-09 | Una vivienda en `in_operation` no aparece en descubrimiento |
| RC-10 | Un `owner` o `seeker` no puede invocar ningún endpoint `/admin/*` (403) |
| RC-11 | Un usuario no puede ver el teléfono de otro participante si este no lo ha autorizado |
| RC-12 | Un usuario no puede dar me gusta a su propia vivienda (422) |
| RC-13 | Un usuario no puede superar el límite diario de likes (429) |
| RC-14 | Un `admin` no puede dar me gusta ni publicar viviendas (403) |
| RC-15 | Ninguna moderación ni suspensión se completa sin una entrada en `audit_log` |
| RC-16 | Un usuario no puede leer ni escribir en el chat de Firestore de un match en el que no participa (reglas de seguridad de Firestore) |
| RC-17 | El cliente no puede fijar `status`, `owner_id`, roles ni compensaciones: la API los ignora o rechaza (400) |
| RC-18 | Un usuario no puede dar me gusta, descartar ni descubrir desde una vivienda que no es suya o no está publicada (`fromHomeId`/`homeId` ajena → 404; propia no publicada → 409) |
| RC-19 | Un `agency` o `admin` no puede crear viviendas (403) |

### Matriz como datos

La correspondencia de §5 se mantiene también como fichero de datos para una
prueba parametrizada que la recorra entera (⚠️ se crea con el scaffold de la
API):

```
services/api/test/authorization/rbac-matrix.json
```

```json
[
  { "operationId": "likeHome", "actor": "seeker", "expected": 403 },
  { "operationId": "likeHome", "actor": "owner", "expected": 201 },
  { "operationId": "getMatch", "actor": "owner:no-participant", "expected": 404 },
  { "operationId": "adminListHomes", "actor": "owner", "expected": 403 }
]
```

Cada fila: operación, actor (rol más calificador), resultado esperado. Una
operación de la API sin filas en ese fichero hace fallar la prueba.

## 5 · Correspondencia con la API

`anon` = sin token. Resultado para cada actor cuando la petición es válida.

| operationId | anon | seeker | owner | admin | Condición |
|---|---|---|---|---|---|
| `getMe` | 401 | ✅ | ✅ | ✅ | `self` |
| `upsertMe` | 401 | ✅ | ✅ | ✅ | `self`; cualquier usuario autenticado, también sin alta previa |
| `deleteMe` | 401 | ✅ | ✅ | 403 | `self` |
| `exportMyData` | 401 | ✅ | ✅ | 403 | `self` |
| `listMyConsents` | 401 | ✅ | ✅ | ✅ | `self` |
| `acceptConsent` | 401 | ✅ | ✅ | ✅ | `self` |
| `registerDevice` | 401 | ✅ | ✅ | ✅ | `self` |
| `listMyHomes` | 401 | ✅ | ✅ | 403 | `self` |
| `createHome` | 401 | ✅ | ✅ | 403 | varias por usuario |
| `getHome` | 401 | ✅ pública / 404 | ✅ pública / 404 | ✅ completa | completa si `resourceOwner`; pública si `published`; si no, 404 |
| `updateHome` | 401 | `resourceOwner` | `resourceOwner` | 403 | ajena → 404; estado → 409 |
| `submitHome` | 401 | `resourceOwner` | `resourceOwner` | 403 | ídem |
| `pauseHome` | 401 | `resourceOwner` | `resourceOwner` | 403 | ídem (un `seeker` solo tiene viviendas sin publicar: 409) |
| `resumeHome` | 401 | `resourceOwner` | `resourceOwner` | 403 | ídem |
| `createHomePhotoUpload` | 401 | `resourceOwner` | `resourceOwner` | 403 | ajena → 404 |
| `completeHomePhotoUpload` | 401 | `resourceOwner` | `resourceOwner` | 403 | ajena → 404 |
| `deleteHomePhoto` | 401 | `resourceOwner` | `resourceOwner` | 403 | ajena → 404 |
| `getMySearchPreferences` | 401 | ✅ | ✅ | 403 | `self` |
| `putMySearchPreferences` | 401 | ✅ | ✅ | 403 | `self` |
| `getHomeSearchPreferences` | 401 | `resourceOwner` | `resourceOwner` | 403 | ajena o sin preferencias propias → 404 |
| `putHomeSearchPreferences` | 401 | `resourceOwner` | `resourceOwner` | 403 | ajena → 404 |
| `deleteHomeSearchPreferences` | 401 | `resourceOwner` | `resourceOwner` | 403 | ajena → 404 |
| `discoverHomes` | 401 | ✅ | ✅ | 403 | filtros RN-06, RN-11, bloqueos |
| `likeHome` | 401 | 403 | ✅ | 403 | `fromHomeId` propia y publicada; RC-12, RC-13, RC-18 |
| `dismissHome` | 401 | ✅ | ✅ | 403 | `owner`: `fromHomeId` propia y publicada (sin ella, 400); `seeker`: desde su cuenta |
| `undoLastAction` | 401 | ✅ | ✅ | 403 | `homeId` propia (ajena → 404); sin acción → 404; like en un match → 409 |
| `listMyMatches` | 401 | ✅ (vacío) | ✅ | 403 | solo los propios |
| `getMatch` | 401 | `participant` / 404 | `participant` / 404 | ✅ sin teléfono ni dirección exacta | no participante → 404 sin descifrar nada; `phone` solo si el titular lo autorizó (RC-11) |
| `confirmMatch` | 401 | `participant` / 404 | `participant` / 404 | 403 | no participante → 404; estado → 409 (`MATCH_NOT_OPEN`); confirmar de nuevo es idempotente |
| `withdrawFromMatch` | 401 | `participant` / 404 | `participant` / 404 | 403 | no participante → 404; estado → 409 (`MATCH_NOT_OPEN`); queda en `audit_log` |
| `setPhoneSharing` | 401 | `participant` / 404 | `participant` / 404 | 403 | solo la fila propia; match `closed` → 409 |
| `sendMatchMessage` | 401 | `participant` / 404 | `participant` / 404 | 403 | no participante → 404; match no `open`/`confirmed` → 409 (`MATCH_NOT_OPEN`, chat de solo lectura); chat sin crear → 409 (`CHAT_NOT_READY`); texto vacío o de más de 2.000 caracteres → 400 |
| `getChatImageUrl` | 401 | `participant` / 404 | `participant` / 404 | 403 | no participante, imagen desconocida o id que no es UUID → 404; vale con el match cerrado |
| `createChatImageUpload` | 401 | `participant` / 404 | `participant` / 404 | 403 | no participante → 404; match no `open`/`confirmed` → 409 (`MATCH_NOT_OPEN`) |

Un `seeker` puede ser participante (por ejemplo, con su vivienda pausada); en la
matriz como datos, que no crea matches, los actores `seeker` y `owner` obtienen
404 en estas operaciones y la pertenencia se prueba con matches reales en
`matches.int.test.ts`.
| `createReport` | 401 | ✅ | ✅ | 403 | 10 por usuario y hora (429); mensaje de un chat ajeno o inexistente → 404; lo propio → 400; la denuncia de un mensaje guarda su evidencia |
| `blockUser` | 401 | ✅ | ✅ | 403 | idempotente (204); a uno mismo → 400; inexistente → 404; efecto en los dos sentidos |
| `adminListHomes` | 401 | 403 | 403 | ✅ | cola `in_review` por envío; sin dirección exacta |
| `adminModerateHome` | 401 | 403 | 403 | ✅ | auditoría en la misma transacción; fuera de revisión → 409; rechazar sin motivo → 400 |
| `adminListReports` | 401 | 403 | 403 | ✅ | abiertas por defecto, de la más antigua a la más reciente, con evidencia |
| `adminResolveReport` | 401 | 403 | 403 | ✅ | nota obligatoria (400); auditoría `report.resolve`/`report.dismiss` en la misma transacción; ya cerrada → 409 |
| `adminListUsers` | 401 | 403 | 403 | ✅ | búsqueda por prefijo de email o nombre; cursor; sin cuentas borradas |
| `adminSetUserSuspension` | 401 | 403 | 403 | ✅ | motivo obligatorio (sin él, 400); auditoría en la misma transacción; a sí mismo u otro admin → 409 |
| `adminGetMetrics` | 401 | 403 | 403 | ✅ | `to` anterior a `from` o más de 366 días → 400 |
| `adminListAuditLog` | 401 | 403 | 403 | ✅ | solo lectura, del más reciente al más antiguo |
| `adminListWaitlist` | 401 | 403 | 403 | ✅ | exportación CSV |
| `joinWaitlist` | ✅ 202 | ✅ 202 | ✅ 202 | ✅ 202 | límite de peticiones, anti-bots |

`agency` no tiene operaciones en el MVP: todas le devuelven 403 salvo las de
`self` (`getMe`, `upsertMe`, consentimientos, dispositivos, exportación).

**Cuenta suspendida** (actor `suspended` en la matriz como datos: un `owner` suspendido). Toda
operación autenticada le devuelve **403** con `code: ACCOUNT_SUSPENDED`, sea cual sea su rol, salvo
`getMe` (200, con `suspended: true`) y `exportMyData`. Las operaciones
públicas (`joinWaitlist`) no cambian. La regla vive en la política central (`allowSuspended` en
`policy.ts`), no en cada caso de uso.

## 6 · Comportamiento ante denegación

| Caso | Respuesta | Qué se registra |
|---|---|---|
| Sin token, token inválido o caducado | **401** `Problem`, sin detalle del motivo | Log `warn` con `correlationId`, ruta e IP; **nunca** el token |
| Autenticado sin el rol requerido (endpoint cuya existencia no es secreta, p. ej. `/admin/*`) | **403** `Problem` | Log `warn` con `correlationId`, `userId`, `operationId` |
| Autenticado sin permiso sobre un recurso cuya existencia no debe revelarse (vivienda ajena no publicada, match ajeno) | **404** `Problem`, idéntico al de un recurso inexistente | Log `info` con `correlationId`, `userId`, `operationId`, id del recurso |
| Transición de estado no permitida (sobre un recurso que sí puede ver) | **409** `Problem` con `code` estable | Log `info` |
| Usuario suspendido | **403** `Problem` con `code: ACCOUNT_SUSPENDED` | Log `warn` |
| Repetición anómala de 403/404 desde un mismo usuario | La misma respuesta | ⚠️ PENDIENTE: umbral de alerta |

Nunca se incluyen en la respuesta ni en los logs: tokens, datos personales,
direcciones exactas, consultas SQL ni trazas.

## Desviaciones detectadas

Contraste hecho al implementar `add-authentication` (2026-10-19). Decisiones que la matriz no
fijaba y que ahora rigen en la política (`services/api/src/interfaces/http/authorization/policy.ts`)
y en `services/api/test/authorization/rbac-matrix.json`:

- **Actor `unregistered`**: identidad con token válido que aún no se ha dado de alta con `upsertMe`.
  Solo puede invocar `upsertMe` (y `joinWaitlist`, que es pública). En las operaciones sobre la
  propia cuenta (`getMe`, `listMyConsents`, `acceptConsent`) recibe **404**, porque su cuenta aún no
  existe; en las demás operaciones con roles, **403**.
- **Una operación implementada sin regla se deniega** (403 con token; 401 sin él).
- La autorización corre en `onRequest`, antes de leer el cuerpo: sin token siempre es 401, aunque el
  cuerpo sea inválido.
- **Usuario suspendido** (403 `ACCOUNT_SUSPENDED`): implementado con `add-user-suspension`
  (2026-10-23). `getMe` y `exportMyData` son las únicas operaciones que lo admiten; el resto, incluidas
  `deleteMe`, las denuncias, los bloqueos y el chat, lo deniegan.
- **Cuenta eliminada** (`add-account-deletion-and-export`): su token se trata como no válido (401) desde
  que se confirma la eliminación, aunque Firebase Auth tarde en darla de baja. `deleteMe` y
  `exportMyData` niegan con 403 a quien no tiene el rol (incluido `unregistered`); `deleteMe` no admite
  `agency` ni `admin` y `exportMyData` no admite `admin`. `exportMyData` limita a 5 por hora y usuario (429).

# Design

## Context

Este change aplica los hallazgos de la auditoría de seguridad del MVP del
2026-10-31: una alta (A1), varias medias (M1–M8) y las bajas B2, B4, B7, B9 y
B10. El código afectado ya existe:
- **Matches:** `getMatch` y `sharedPhones` en matching; `exactAddresses` en
  `drizzle-match-homes`.
- **Cuentas:** el borrado de la cuenta (`account-deletion`).
- **Moderación:** el bloqueo (`report-operations`) y el cierre de matches que
  ya usa la suspensión.
- **Fotos y chat:** las subidas por URL firmada (`cloud-photo-storage` y
  `cloud-chat-image-storage`) y el procesado con sharp.
- **Plataforma:** `firebase.json`, `deploy.yml`, `config.ts`, el logger de
  Fastify e `infra/gcp/bootstrap.sh`.

## Decisions

- **Datos de contacto según el estado del match**:
  - `getMatch` calcula `contactVisible` con dos condiciones: el estado es
    `open` o `confirmed`, y el solicitante no figura como retirado.
  - Si es falso, ni descifra direcciones ni lee teléfonos; los campos van como
    `null` y el contrato ya los admite como opcionales.
  - El admin sigue el mismo criterio: en un match cerrado no ve contacto.
- **Retirada de la autorización del teléfono**:
  - `setPhoneSharing(false)` se acepta en cualquier estado; solo
    `setPhoneSharing(true)` exige `open` o `confirmed` (409 en otro caso).
  - Todo cierre de match pone `shares_phone = false` a todos sus participantes
    en la misma transacción: retirada, suspensión, bloqueo y cuenta eliminada.
    Se centraliza en el repositorio de matches (`closeMatch`) para que ningún
    camino lo olvide.
- **Teléfono en el perfil**: el esquema compartido de `upsertMe` acepta
  `phone: null`. `null` borra el teléfono; omitir el campo sigue significando
  «no tocar». En la app, vaciar el campo envía `null`. Los matches leen el
  teléfono actual, así que borrarlo lo retira de todos.
- **Cuenta eliminada**: el borrado pone `exact_address = NULL`, `exact_location =
  NULL` y `exact_address_key_version = NULL` en sus viviendas, en la misma
  transacción. Las viviendas `closed` no se descifran nunca, y la lectura
  tolera direcciones nulas.
- **Bloqueo**:
  - `blockUser` cierra en la misma transacción los matches `open` o `confirmed`
    donde participan los dos, con el motivo `blocked`. Reutiliza el cierre de
    la suspensión, que ya pone el chat en solo lectura y encola las
    notificaciones.
  - Las notificaciones de cierre por bloqueo no se envían a quien bloquea: el
    outbox recibe la lista de destinatarios ya filtrada.
  - `sendMatchMessage` ya rechaza los matches cerrados, y por eso no necesita
    comprobar el bloqueo aparte.
- **Suspendido que borra su cuenta**: `deleteMe` pasa a `allowSuspended: true`
  en `policy.ts`, con su fila en la matriz (`suspended` → 204). La pantalla de
  suspensión añade «Eliminar mi cuenta» con la misma doble confirmación.
- **Subidas**:
  - Las URL firmadas de fotos y de imágenes del chat llevan
    `extensionHeaders: {'x-goog-content-length-range': '0,26214400'}`.
    fake-gcs no lo valida, así que la prueba comprueba la firma generada.
  - `requestUpload` cuenta las fotos `pending` de la vivienda y responde 409
    `TOO_MANY_PENDING_PHOTOS` a partir de 25.
  - Las subidas de imágenes del chat usan un limitador por usuario de 30 por
    hora, en memoria como los demás limitadores (B1 queda aplazado).
- **Procesado de imágenes**:
  - `MAX_INPUT_PIXELS = 40_000_000`.
  - Un semáforo de proceso con 2 permisos envuelve el procesado con sharp. Si
    se superan los 30 s de espera, responde 503 con `Retry-After`.
  - La descarga del original fija la generación leída en `getMetadata`
    (`ifGenerationMatch`).
- **Purga programada**:
  - El job vive en la API con un intervalo de 24 h y `pg_try_advisory_lock`,
    para que corra una sola instancia, siguiendo el patrón del dispatcher del
    outbox.
  - **Chat:** los matches `closed` con `closed_at < now() - 12 meses` y el chat
    sin purgar. Borra la colección de mensajes en Firestore y sus imágenes, y
    marca `chat_purged_at`.
  - **Lista de espera:** si `LAUNCH_DATE` está definida y `now() > LAUNCH_DATE
    + 12 meses`, borra las inscripciones.
  - Cada ejecución con efecto deja una entrada en la auditoría: acción
    `retention.purge`, entidad `chat` o `waitlist` y el recuento en el detalle.
  - Hace falta una migración que añada `matches.chat_purged_at`. La auditoría
    admite el nuevo tipo de entidad.
- **Cabeceras web**:
  - `firebase.json` añade a los dos sitios `X-Frame-Options: DENY` y una CSP:
    `default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`,
    `base-uri 'self'`.
  - La app web incluye además en `connect-src` y `img-src` los orígenes de la
    API, Firebase Auth, Firestore, Storage y Sentry.
  - La landing solo permite la API (lista de espera) y Sentry, y en
    `style-src` añade `'unsafe-inline'` solo si Astro lo exige.
  - Los dominios por entorno no se escriben a mano. Se generan en el job de
    despliegue a partir de `vars` y se inyectan en `firebase.json` antes de
    desplegar.
- **Despliegue**:
  - El job de PROD despliega también `firestore:rules,storage`.
  - `inputs.image_digest` pasa por `env:` y se valida con
    `^europe-southwest1-docker\.pkg\.dev/[a-z0-9-]+/changehouse/api@sha256:[0-9a-f]{64}$`.
  - El environment `prod` exige la rama `master` (se documenta su configuración
    en GitHub y el job lo comprueba con `github.ref`).
  - Las acciones `checkout`, `setup-node`, `setup-java` y `upload-artifact` se
    fijan por SHA, con su versión en un comentario.
  - `.dockerignore` excluye `.env*`, `*.pem`, `*-key.json` y `.git`.
- **Infraestructura de buckets**: `infra/gcp/bootstrap.sh` crea los dos buckets
  con estas condiciones:
  - el ciclo de vida borra al día `originals/` y `chat-uploads/` del bucket
    privado;
  - el bucket público da `roles/storage.legacyObjectReader` a `allUsers`, que
    permite leer sin listar, con acceso uniforme;
  - la API recibe `objectAdmin` solo sobre esos dos buckets.
- **Configuración y registros**:
  - `config.ts` exige `LANDING_ORIGIN` y `APP_ORIGIN` con `K_SERVICE`, igual que
    `APP_PUBLIC_URL`.
  - El serializador de peticiones del logger registra `req.url` sin query
    string.
  - El serializador de errores omite `detail`, `where` y `parameters` de los
    errores de PostgreSQL.
- **Documentación**: `rbac-matrix.md` corrige `getHome` para el admin (forma
  pública, B10) y añade `deleteMe` del suspendido. `docs/project.md` añade
  `LAUNCH_DATE` y los plazos de retención aplicados.

## Risks / Trade-offs

- [La CSP puede bloquear recursos que no conocemos] → Las pruebas E2E de la web
  se ejecutan con las cabeceras. La CSP se despliega primero en DES y se revisa
  la consola antes de PROD.
- [La purga borra datos de forma irreversible] → Prueba de integración con
  fechas en el límite (11 y 13 meses), recuento auditado y bloqueo consultivo.
- [El límite de tamaño de la URL firmada no lo valida fake-gcs] → Se prueba la
  firma generada. La validación real se comprueba en DES (análisis dinámico).

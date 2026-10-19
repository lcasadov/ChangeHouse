# Design

## Context

Las viviendas llegan a `in_review` con `submitHome` (`add-home-listing`) y
tienen al menos 3 fotos (`add-home-photos`). El contrato ya declara
`adminListHomes` y `adminModerateHome` con `x-roles: [admin]`; `homes` tiene la
columna `moderation_note` y el modelo de datos define `audit_log`. Motivación en
`proposal.md`.

## Decisions

- **Cola = `adminListHomes?status=in_review`** ordenada por `submitted_at`
  ascendente (columna nueva en `homes`, fijada por `submitHome`) con paginación
  por cursor opaco sobre `(submitted_at, id)`. Sin `status` devuelve todas las
  viviendas por fecha de actualización, para el panel de administración futuro.
- **Vista de administración**: la cola y la respuesta de moderación devuelven la
  ficha completa con fotos (`Home`), sin la dirección exacta cifrada: el admin no
  la necesita para moderar y no se descifra fuera del propietario.
- **Motivo visible para el propietario**: se añade `moderationNote`
  (`string | null`) al esquema `Home` del contrato. Se rellena al rechazar, se
  conserva al volver a enviar y se limpia al aprobar. Solo aparece en la vista
  del propietario y del admin, nunca en la pública.
- **Transiciones en el dominio**: `approveHome` (`in_review → published`) y
  `rejectHome(reason)` (`in_review → draft`, motivo de 1 a 1000 caracteres tras
  recortar espacios). Cualquier otro estado → `conflict` (409). Rechazar sin
  motivo es un error de validación de la petición (400, no 422), porque el
  contrato documenta el motivo como obligatorio al rechazar.
- **Auditoría transaccional**: puerto `AuditLog.record(entry, tx)` y un puerto
  `UnitOfWork` que abre la transacción de Drizzle; el caso de uso guarda la
  vivienda y la entrada en la misma transacción, y un fallo de auditoría revierte
  la decisión (500 con `Problem`). `audit_log` usa `bigint` identidad; la
  migración revoca `UPDATE`, `DELETE` y `TRUNCATE` al rol de la aplicación cuando
  existe (`DO $$ … $$`), y un disparador rechaza `UPDATE`/`DELETE` para que el
  solo-inserción se cumpla también en local.
- **Acciones auditadas**: `home.approve` y `home.reject`, entidad `home`. El
  motivo no se guarda en la auditoría (ya está en la vivienda y puede contener
  datos personales).
- **Rol `owner` derivado**: no se persiste; al publicar, `GET /me` lo deriva de
  la vivienda publicada como ya hace `add-home-listing`.
- **`admin:grant <email>`**: script de `services/api` que busca el usuario por
  email y fija `assigned_role = 'admin'`; falla si no existe o si tiene
  viviendas activas (los roles asignados son excluyentes con publicar). No
  escribe en `audit_log`, que exige un actor usuario; lo deja en el log
  estructurado del proceso, que ejecuta un operador con acceso a la base.
- **App**: pestaña «Administración» en lugar de «Mis casas» cuando el rol es
  `admin` (el admin no publica). Cola en tarjetas con la foto principal, detalle
  con carrusel y dos acciones; rechazar abre una hoja con el motivo obligatorio y
  motivos frecuentes como atajos.

## Risks / Trade-offs

- [La concesión de `admin` no queda en `audit_log`] → se registra en el log
  estructurado; el panel de administración podrá auditar concesiones hechas
  desde la app.
- [Dos admins moderan a la vez] → la transición se hace con `SELECT … FOR
  UPDATE`; el segundo recibe 409.
- [Cambios relevantes tras publicar no vuelven a revisión] → fuera de alcance;
  queda para la reedición de viviendas publicadas.

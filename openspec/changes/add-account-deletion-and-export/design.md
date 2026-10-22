# Design

## Context

Existen cuenta (`users`, Firebase Auth), viviendas, preferencias, likes,
descartes, matches, consentimientos, auditoría, dispositivos y, en Firestore,
chats. El contrato declara `deleteMe` y `exportMyData`. Retención: chat hasta
12 meses tras el fin del match; auditoría 2 años. Motivación en `proposal.md`.

## Decisions

- **Borrado lógico en una transacción** (`deleteMe`): `users.deleted_at`;
  email sustituido por `deleted+<id>@changehouse.invalid`; nombre visible
  «Usuario eliminado»; teléfono y municipio nulos; viviendas a `closed` (sus
  fotos públicas se borran del almacenamiento tras confirmar); matches
  abiertos o confirmados cerrados para todos, con el participante `withdrawn`
  y auditoría `user.delete`; preferencias, dispositivos, likes y descartes
  borrados; consentimientos y auditoría conservados. Tras confirmar la
  transacción, baja en Firebase Auth con `deleteUser`, reintentable; si falla,
  una reconciliación la repite.
- **Email libre**: al anonimizarse, el índice único no choca y un nuevo
  registro con el mismo email crea otro usuario.
- **Chats**: los mensajes del usuario en Firestore se conservan durante la
  retención con el remitente renombrado a «Usuario eliminado».
- **Exportación** (`exportMyData`): JSON con cuenta, viviendas (con su propia
  dirección descifrada), preferencias, likes, descartes, matches (solo sus
  datos de participante y los ids de las otras viviendas, sin datos de otros
  usuarios) y consentimientos; `Content-Disposition: attachment`; como mucho
  5 exportaciones por hora.
- **App**: en «Perfil», «Descargar mis datos» (descarga en web, compartir en
  móvil) y «Eliminar mi cuenta» en dos pasos: qué se borra y qué se conserva,
  y confirmación escribiendo «ELIMINAR».

## Risks / Trade-offs

- [Fallo entre la base y Firebase Auth] → la cuenta queda anonimizada y
  bloqueada en la API aunque Auth tarde en borrarse; la reconciliación termina
  el borrado.

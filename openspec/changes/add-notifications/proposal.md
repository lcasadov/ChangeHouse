# Proposal

## Why

La permuta es de baja frecuencia: si el usuario no se entera de un match o de un
mensaje, la oportunidad se enfría. Las notificaciones son las que traen al
usuario de vuelta (RF-61, RF-62; riesgo «baja frecuencia de uso», README §15).

## What Changes

- Registro del dispositivo para notificaciones push (`registerDevice`) y
  petición de permiso en un momento con sentido (tras el primer me gusta), no al
  abrir la app.
- Push por Firebase Cloud Messaging de: nuevo match, nuevo mensaje en un match y
  cambio de estado del match (confirmado por todos, cerrado).
- Email de nuevo match y de match cerrado mediante la extensión Trigger Email de
  Firebase (SMTP de Gmail provisional).
- Las notificaciones nunca incluyen datos privados (dirección, teléfono,
  importes).
- Tocar una notificación abre el match o el chat correspondiente.
- Fuera de alcance: preferencias de notificación por tipo, alertas de nuevas
  viviendas compatibles.

## Capabilities

### New Capabilities

- `notifications`: avisos al usuario por push y email de los eventos clave.

### Modified Capabilities

Ninguna.

## Impact

- `services/api`: tabla `user_devices`, puerto `Notifier` con adaptadores FCM y
  correo (documento en la colección `mail`), despacho desde el outbox, ruta
  `registerDevice` y su fila en la matriz.
- `apps/mobile`: `expo-notifications`, permiso contextual, navegación al tocar.
- Configuración: credenciales de FCM y de la cuenta SMTP en Secret Manager.

**Capacidad principal**: `notifications`

## Trazabilidad

| Nivel | Decisión | Motivo |
|---|---|---|
| Epic | nuevo | No existe `cap:notifications` |
| Feature | nuevo | Change nuevo |
| Story | nuevo | Una por requisito del spec delta |
| Task | nuevo | Una por línea de `tasks.md` |

| Requirement | Decisión | Story Points | Prioridad |
|---|---|---|---|
| Registro del dispositivo y permiso contextual | nuevo | 3 | P1 |
| Avisos push de los eventos clave | nuevo | 5 | P1 |
| Avisos por email | nuevo | 3 | P2 |
| Avisos sin datos privados | nuevo | 2 | P1 |

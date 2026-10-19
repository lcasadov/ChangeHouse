# Proposal

## Why

El diseño de ChangeHouse es «foto primero»: una vivienda sin buenas fotos no
se descubre. Además, las fotos de un móvil llevan la ubicación en sus
metadatos, que no puede publicarse (RF-11, RNF-03).

## What Changes

- Subida de entre 3 y 20 fotos por vivienda mediante URL firmadas de corta
  duración (`createHomePhotoUpload`), confirmación de la subida y procesado en
  el servidor: compresión, tamaño máximo y eliminación de todos los metadatos
  EXIF (incluida la ubicación) antes de que la foto sea visible.
- **Ampliación del contrato**: nueva operación
  `POST /homes/{homeId}/photos/{photoId}/complete` (`completeHomePhotoUpload`)
  para confirmar la subida y lanzar el procesado.
- Eliminación de fotos (`deleteHomePhoto`) sin bajar de 3 en una vivienda
  publicada.
- El envío a revisión exige al menos 3 fotos procesadas.
- Primer paso del asistente de alta dedicado a las fotos, con progreso por foto.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `homes`: fotos de la vivienda y mínimo de fotos para el envío a revisión.

## Impact

- `services/api`: tabla `home_photos`, puerto `PhotoStorage` (Cloud Storage;
  `fake-gcs-server` en local y pruebas), procesado de imágenes con `sharp`,
  rutas de fotos y filas de la matriz.
- `docker-compose.yml`: servicio `fake-gcs-server`.
- `docs/api/openapi.yaml`: operación `completeHomePhotoUpload`.
- `apps/mobile`: selector de fotos (`expo-image-picker`), subida con progreso,
  orden y borrado.

**Capacidad principal**: `homes`

## Trazabilidad

| Nivel | Decisión | Motivo |
|---|---|---|
| Epic | existente | Epic de `homes`, creada por `add-home-listing` |
| Feature | nuevo | Change nuevo |
| Story | nuevo | Una por requisito del spec delta |
| Task | nuevo | Una por línea de `tasks.md` |

| Requirement | Decisión | Story Points | Prioridad |
|---|---|---|---|
| Fotos de la vivienda | nuevo | 5 | P1 |
| Fotos sin metadatos de ubicación | nuevo | 3 | P1 |
| Envío a revisión | nuevo | 1 | P1 |

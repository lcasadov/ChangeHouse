# Design

## Context

`homes` existe con su asistente (`add-home-listing`). El contrato define
`createHomePhotoUpload` (URL firmada) y `deleteHomePhoto`, pero no cómo sabe la
API que la subida terminó. Motivación en `proposal.md`.

## Decisions

- **Subida directa al almacenamiento con URL firmada V4** (15 minutos, tipo de
  contenido fijado) y **confirmación explícita** con la nueva operación
  `completeHomePhotoUpload`, que descarga el original, lo procesa, guarda la
  versión pública y borra el original. Alternativas descartadas: subir a través
  de la API (consume CPU y memoria de Cloud Run) y procesar con un disparador
  de Cloud Storage (más infraestructura y difícil de probar en local).
- **Dos ubicaciones**: originales en un bucket privado temporal y fotos
  procesadas en el bucket público servido por CDN (RNF-03).
- **`sharp`** para eliminar metadatos (`withMetadata` desactivado), rotar según
  la orientación antes de borrarla, redimensionar a 2048 px y comprimir a WebP.
- **Local y pruebas** con `fake-gcs-server` (acepta subidas a URL firmadas sin
  validar la firma); el adaptador de producción usa `@google-cloud/storage`.
- **Estados de foto** `pending` → `ready`; solo `ready` se devuelve y cuenta
  para el mínimo de 3.

## Risks / Trade-offs

- [Originales huérfanos si nunca se confirman] → regla de ciclo de vida del
  bucket privado que borra objetos de más de 24 h.
- [HEIC en `sharp`] → se verifica en la prueba de integración; si la
  compilación no lo soporta, la app convierte a JPEG antes de subir.

# Tasks

## 1. Almacenamiento y procesado

- [x] B1 Añadir `fake-gcs-server` a `docker-compose.yml` y a las pruebas de integración, la tabla `home_photos` con su migración (estado `pending`/`ready`, posición) y la operación `completeHomePhotoUpload` en el contrato, y verificar que la migración se aplica y Redocly valida. ref: Fotos de la vivienda · est: 2h · disc: bd
  - GIVEN el contrato actualizado WHEN se valida con Redocly THEN no hay errores
- [x] T1 Escribir las pruebas del procesado de imágenes (elimina EXIF y GPS, redimensiona a 2048 px, rechaza ficheros que no son imágenes) con imágenes de ejemplo generadas en la prueba, y comprobar que fallan. ref: Fotos sin metadatos de ubicación · est: 2h · disc: qa
  - GIVEN un JPEG con coordenadas GPS WHEN se procesa THEN el resultado no tiene bloque EXIF
- [x] B2 Implementar el procesado con `sharp` detrás del puerto `ImageProcessor` y verificar que pasan las pruebas de T1. ref: Fotos sin metadatos de ubicación · est: 2h · disc: back
  - GIVEN una imagen de 4000 px WHEN se procesa THEN su lado mayor es 2048 px

## 2. API de fotos

- [x] T2 Escribir las pruebas de integración de emitir URL, subir, confirmar, consultar (solo fotos `ready`), límite de 20 (409), borrado bajo el mínimo en publicada (409), fichero inválido (422) y envío a revisión con menos de 3 fotos (422), con sus filas en la matriz, y comprobar que fallan. ref: Fotos de la vivienda · est: 4h · disc: qa
  - GIVEN una URL emitida sin confirmar WHEN se consulta la vivienda THEN esa foto no aparece
- [x] B3 Implementar el puerto `PhotoStorage` (URL firmadas V4 de Cloud Storage; adaptador para `fake-gcs-server`), los casos de uso y rutas de fotos y la regla de 3 fotos en el envío, y verificar que pasan las pruebas de T2. ref: Envío a revisión · est: 5h · disc: back
  - GIVEN una vivienda con 3 fotos procesadas WHEN se envía a revisión THEN pasa a `in_review`

## 3. App

- [x] T3 Escribir las pruebas de componentes del paso de fotos (selección, progreso por foto, error y reintento, límite, borrado con confirmación) y comprobar que fallan. ref: Fotos de la vivienda · est: 3h · disc: qa
  - GIVEN una subida que falla WHEN se muestra THEN la foto ofrece «Reintentar» sin perder las demás
- [x] F1 Implementar el paso de fotos como primer paso del asistente con `expo-image-picker`, subida directa a la URL firmada con progreso y confirmación, y verificar que pasan las pruebas de T3. ref: Fotos de la vivienda · est: 5h · disc: front
  - GIVEN tres fotos subidas WHEN se avanza THEN el asistente pasa al paso de tipo y dirección

## 4. Integración

- [x] V1 Ejecutar `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage`, `pnpm test:integration` y `pnpm build` y verificar que todo pasa con cobertura ≥ 80 %. ref: Fotos de la vivienda · est: 1h · disc: qa
  - GIVEN el change implementado WHEN se ejecuta la puerta de calidad local THEN todos los comandos terminan con éxito

## Workflow follow-up

- `/opsx:verify`, `/opsx:sync` y `/opsx:archive` tras la implementación.

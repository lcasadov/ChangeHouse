# Tasks

## 1. API

- [x] T1 Escribir las pruebas (unitarias y de integración) de los datos de contacto: detalle sin dirección ni teléfono en un match cerrado o para quien se retiró; revocar el teléfono en un match cerrado; el cierre retira las autorizaciones; borrar el teléfono con `phone: null`; la eliminación de la cuenta borra la dirección y la ubicación exactas. Comprobar que fallan. ref: Detalle del match para sus participantes · est: 5h · disc: qa
  - GIVEN un match cerrado WHEN un participante pide su detalle THEN no recibe direcciones ni teléfonos
- [x] B1 Implementar los datos de contacto según el estado del match, la retirada de autorizaciones al cerrar, `phone: null` en el esquema compartido y el borrado de la dirección y la ubicación al eliminar la cuenta, y verificar que pasan las pruebas de T1. ref: Teléfono solo con autorización · est: 5h · disc: back
  - GIVEN un usuario que elimina su cuenta WHEN se consultan sus viviendas THEN no tienen dirección ni ubicación exactas
- [x] T2 Escribir las pruebas del bloqueo que cierra los matches activos sin avisar a quien bloquea, de `deleteMe` para un suspendido (con su fila en la matriz) y comprobar que fallan. ref: Bloquear a un usuario · est: 3h · disc: qa
  - GIVEN un match abierto entre A y B WHEN A bloquea a B THEN el match queda cerrado y A no recibe aviso
- [x] B2 Implementar el cierre de matches al bloquear y la exención de `deleteMe` para suspendidos, y verificar que pasan las pruebas de T2. ref: Efecto de la suspensión · est: 3h · disc: back
  - GIVEN un usuario suspendido WHEN elimina su cuenta THEN la API responde 204 y sus denuncias se conservan
- [x] T3 Escribir las pruebas de los límites de subida: URL firmada con el rango de tamaño, 409 con 25 fotos pendientes, 429 con más de 30 imágenes del chat por hora, rechazo de imágenes de más de 40 MP y 503 al agotar la espera del semáforo. Comprobar que fallan. ref: Límites de las subidas de fotos · est: 3h · disc: qa
  - GIVEN una vivienda con 25 fotos pendientes WHEN se pide otra subida THEN la API responde 409
- [x] B3 Implementar los límites de subida, el semáforo del procesado y la descarga con `ifGenerationMatch`, y verificar que pasan las pruebas de T3. ref: Límite de imágenes del chat · est: 5h · disc: back
  - GIVEN 31 peticiones de subida del chat en una hora WHEN llega la última THEN la API responde 429 con `Retry-After`
- [x] T4 Escribir las pruebas de integración de la purga programada (chat a 11 y 13 meses del cierre, lista de espera con y sin `LAUNCH_DATE`, entrada de auditoría y bloqueo consultivo) y comprobar que fallan. ref: Retención del chat · est: 3h · disc: qa
  - GIVEN un match cerrado hace 13 meses WHEN corre la purga THEN su chat se borra y la auditoría lo registra
- [x] B4 Crear la migración de `matches.chat_purged_at` e implementar el job de purga del chat y de la lista de espera con su auditoría, y verificar que pasan las pruebas de T4. ref: Retención de la lista de espera · est: 5h · disc: bd
  - GIVEN que no hay `LAUNCH_DATE` WHEN corre la purga THEN no se borra ninguna inscripción
- [x] T5 Escribir las pruebas de configuración y registros: arranque en Cloud Run sin `LANDING_ORIGIN` o `APP_ORIGIN`, URL registrada sin query string y error de PostgreSQL sin `detail`. Comprobar que fallan. ref: Configuración y registros seguros · est: 2h · disc: qa
  - GIVEN `K_SERVICE` sin `APP_ORIGIN` WHEN arranca la API THEN falla nombrando la variable
- [x] B5 Implementar la configuración obligatoria y los serializadores del logger, y verificar que pasan las pruebas de T5. ref: Configuración y registros seguros · est: 2h · disc: back
  - GIVEN una búsqueda de usuarios con `q` WHEN se registra la petición THEN el registro no contiene `q`

## 2. App

- [ ] T6 Escribir las pruebas de componentes del match cerrado sin dirección ni teléfono, de vaciar el teléfono en el perfil, de «Eliminar mi cuenta» en la pantalla de suspensión y de los mensajes de 409 y 429 en las subidas, y comprobar que fallan. ref: Borrar el teléfono · est: 3h · disc: qa
  - GIVEN un usuario suspendido WHEN abre la app THEN ve «Eliminar mi cuenta» junto a exportar y cerrar sesión
- [ ] F1 Implementar esas pantallas y mensajes, regenerar los tipos del contrato y verificar que pasan las pruebas de T6. ref: Eliminar la cuenta · est: 5h · disc: front
  - GIVEN un perfil con teléfono WHEN se vacía el campo y se guarda THEN la cuenta queda sin teléfono

## 3. Plataforma

- [ ] D1 Añadir la CSP y `X-Frame-Options` a la app y a la landing en `firebase.json`, generar los orígenes por entorno en el despliegue y comprobar con los E2E de la web que no hay violaciones. ref: Cabeceras de seguridad de la web · est: 3h · disc: devops
  - GIVEN la app servida con la CSP WHEN se recorren los flujos E2E THEN no hay violaciones en la consola
- [x] D2 Desplegar las reglas en PROD y crear los buckets con ciclo de vida, lectura sin listado y permisos acotados en `infra/gcp/bootstrap.sh`. ref: Reglas y almacenamiento desplegados en todos los entornos · est: 3h · disc: devops
  - GIVEN el script de infraestructura WHEN crea el bucket público THEN concede `legacyObjectReader` y no `objectViewer` a `allUsers`
- [x] D3 Pasar `image_digest` por `env:` con validación, restringir PROD a `master`, fijar las acciones por SHA y ampliar `.dockerignore`. ref: Despliegue sin inyección · est: 2h · disc: devops
  - GIVEN un digest con `$(...)` WHEN se lanza la promoción THEN el workflow falla antes de desplegar
- [x] D4 Actualizar `openapi.yaml` (409 `TOO_MANY_PENDING_PHOTOS`, 429 de imágenes del chat, `phone: null`), `rbac-matrix.md` (`getHome` del admin y `deleteMe` del suspendido) y `docs/project.md` (`LAUNCH_DATE` y retención). ref: Configuración y registros seguros · est: 1h · disc: docs
  - GIVEN el contrato actualizado WHEN se regeneran los tipos de la app THEN compilan sin cambios manuales

## 4. Integración

- [ ] V1 Ejecutar `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage`, `pnpm test:integration` y `pnpm build` y verificar que todo pasa con cobertura ≥ 80 %. ref: Detalle del match para sus participantes · est: 1h · disc: qa
  - GIVEN el change implementado WHEN se ejecuta la puerta de calidad local THEN todos los comandos terminan con éxito

## Workflow follow-up

- `/opsx:verify`, `/opsx:sync` y `/opsx:archive` tras la implementación.

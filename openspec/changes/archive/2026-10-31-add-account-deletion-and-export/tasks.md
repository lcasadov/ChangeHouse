# Tasks

## 1. API

- [x] T1 Escribir las pruebas de integración de `deleteMe` (anonimización, viviendas cerradas, matches cerrados para todos, dispositivos y preferencias borrados, baja en el emulador de Auth, email reutilizable, consentimientos conservados) y de `exportMyData` (contenido propio sin datos ajenos), con sus filas en la matriz, y comprobar que fallan. ref: Eliminar la cuenta · est: 4h · disc: qa
  - GIVEN una cuenta eliminada WHEN se registra de nuevo el mismo email THEN el alta funciona como un usuario nuevo
- [x] B1 Implementar el caso de uso transaccional de eliminación (con la baja en el proveedor de identidad tras confirmar la transacción y reintento si falla) y la ruta `deleteMe`, y verificar sus pruebas de T1. ref: Eliminar la cuenta · est: 5h · disc: back
  - GIVEN un fallo al dar de baja en Firebase Auth WHEN se reintenta THEN la baja termina sin duplicar efectos
- [x] B2 Implementar el caso de uso de exportación y la ruta `exportMyData`, y verificar sus pruebas de T1. ref: Exportar mis datos · est: 3h · disc: back
  - GIVEN un match WHEN se exporta THEN solo aparece la participación propia

## 2. App

- [x] T2 Escribir las pruebas de componentes de eliminar la cuenta (explicación, escribir «ELIMINAR», cierre de sesión) y de exportar (compartir el fichero), y comprobar que fallan. ref: Eliminar la cuenta · est: 2h · disc: qa
  - GIVEN el texto «eliminar» en minúsculas WHEN se confirma THEN el botón sigue deshabilitado
- [x] F1 Implementar las dos acciones en «Perfil» y verificar que pasan las pruebas de T2. ref: Exportar mis datos · est: 3h · disc: front
  - GIVEN la exportación terminada WHEN responde la API THEN se abre el diálogo para guardar o compartir el JSON

## 3. Integración

- [x] V1 Ejecutar `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage`, `pnpm test:integration` y `pnpm build` y verificar que todo pasa con cobertura ≥ 80 %. ref: Eliminar la cuenta · est: 1h · disc: qa
  - GIVEN el change implementado WHEN se ejecuta la puerta de calidad local THEN todos los comandos terminan con éxito

## Workflow follow-up

- `/opsx:verify`, `/opsx:sync` y `/opsx:archive` tras la implementación.

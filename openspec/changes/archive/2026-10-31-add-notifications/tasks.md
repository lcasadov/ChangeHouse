# Tasks

## 1. API

- [x] B1 Crear la tabla `user_devices` con su migración y verificar que se aplica. ref: Registro del dispositivo y permiso contextual · est: 1h · disc: bd
  - GIVEN el mismo token registrado dos veces WHEN se inserta THEN queda una sola fila actualizada
- [x] T1 Escribir las pruebas de `registerDevice` (alta y refresco) y del despacho de avisos desde el outbox con dobles de FCM y de correo (nuevo match, nuevo mensaje solo al otro, confirmado y cerrado, token inválido eliminado, fallo con reintento, contenido sin datos privados), con su fila en la matriz, y comprobar que fallan. ref: Avisos push de los eventos clave · est: 4h · disc: qa
  - GIVEN un mensaje con una dirección WHEN se genera su aviso THEN el texto no contiene la dirección
- [x] B2 Implementar el puerto `Notifier` con el adaptador de FCM (`firebase-admin/messaging`) y el de correo (documento en `mail` para Trigger Email), las plantillas de aviso en español, el despacho desde el outbox y la ruta `registerDevice`, y verificar que pasan las pruebas de T1. ref: Avisos sin datos privados · est: 6h · disc: back
  - GIVEN un token rechazado por FCM como no registrado WHEN se procesa la respuesta THEN se borra de `user_devices`
- [x] B3 Implementar la plantilla de email de nuevo match y de match cerrado (HTML accesible y texto plano) y verificar su prueba de contenido. ref: Avisos por email · est: 2h · disc: back
  - GIVEN un match nuevo WHEN se genera el email THEN incluye el enlace a la app y no incluye importes

## 2. App

- [x] T2 Escribir las pruebas del permiso contextual tras el primer me gusta, del registro del token y de la navegación al tocar un aviso, y comprobar que fallan. ref: Registro del dispositivo y permiso contextual · est: 2h · disc: qa
  - GIVEN un aviso de nuevo mensaje WHEN se toca THEN se abre el chat de ese match
- [x] F1 Implementar `expo-notifications` con la explicación previa al permiso, el registro en la API y la navegación por enlace profundo, y verificar que pasan las pruebas de T2. ref: Avisos push de los eventos clave · est: 4h · disc: front
  - GIVEN el permiso denegado WHEN el usuario sigue usando la app THEN no se le vuelve a pedir en cada me gusta

## 3. Integración

- [x] V1 Ejecutar `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage`, `pnpm test:integration` y `pnpm build` y verificar que todo pasa con cobertura ≥ 80 %. ref: Avisos push de los eventos clave · est: 1h · disc: qa
  - GIVEN el change implementado WHEN se ejecuta la puerta de calidad local THEN todos los comandos terminan con éxito

## Workflow follow-up

- `/opsx:verify`, `/opsx:sync` y `/opsx:archive` tras la implementación.

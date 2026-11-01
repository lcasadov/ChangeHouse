# Tasks

## 1. Imágenes y vídeo de prueba

- [x] T1 Escribir las pruebas del generador de escenas: cada escena produce un JPEG del tamaño pedido, la misma semilla da los mismos bytes y semillas distintas dan imágenes distintas. Comprobar que fallan. ref: Secciones con fotografía · est: 2h · disc: qa
  - GIVEN la escena `salon` con la semilla 7 WHEN se genera dos veces THEN los dos JPEG son idénticos
- [x] D1 Implementar `scripts/media/scenes.mjs` y `scripts/media/generate.mjs` (imágenes de la landing y de la app, vídeo del héroe grabado con el Chromium de Playwright), generar y versionar los recursos dentro del presupuesto de tamaño, y verificar que pasan las pruebas de T1. ref: Vídeo de fondo del héroe · est: 6h · disc: devops
  - GIVEN el generador WHEN se ejecuta THEN escribe `hero.webm`, `hero.mp4` y `hero-poster.jpg` de menos de 3 MB y 250 KB
- [ ] D2 Sustituir los dibujos de `scripts/seed-demo.mjs` por cuatro escenas variadas por casa y documentar la regeneración en `docs/desarrollo-local.md`. ref: Estados vacíos con imagen · est: 2h · disc: devops
  - GIVEN una base vacía WHEN se ejecuta `pnpm seed:demo` THEN cada casa tiene cuatro fotos distintas de exterior, salón, cocina y dormitorio

## 2. Tokens

- [x] T2 Escribir las pruebas de contraste del token `color.photoVeil` (blanco sobre el velo encima de un píxel blanco ≥ 4,5:1) y de `primary` sobre `surfaceMuted` en los dos temas, y comprobar que fallan. ref: Navegación principal legible · est: 1h · disc: qa
  - GIVEN el velo sobre blanco puro WHEN se mide el texto blanco THEN el contraste es de al menos 4,5:1
- [x] F1 Añadir `color.photoVeil` a `packages/ui` (TS y CSS) y a `docs/style-guide.md`, y verificar que pasan las pruebas de T2. ref: Navegación principal legible · est: 1h · disc: front
  - GIVEN el tema oscuro WHEN se lee `photoVeil` THEN existe con el mismo valor que en el claro

## 3. Landing

- [x] T3 Escribir las pruebas unitarias de `hero-video.ts` (reproducir por defecto; imagen fija con movimiento reducido o ahorro de datos; pausar, reanudar y estado del control; fallo de `play()`) y las E2E del héroe (titular sobre el fondo sin desplazar, vídeo oculto a lectores, control con teclado, movimiento reducido, fotos de los pasos con `alt`, carga diferida y axe en los dos temas). Comprobar que fallan. ref: Vídeo de fondo del héroe · est: 4h · disc: qa
  - GIVEN «reducir movimiento» emulado WHEN se abre la página THEN el vídeo está en pausa y el control ofrece reproducirlo
- [x] F2 Implementar el héroe a pantalla completa con vídeo, velo, control de pausa y cabecera superpuesta, y verificar que pasan las pruebas de T3 del héroe. ref: Presentación de la propuesta de valor · est: 5h · disc: front
  - GIVEN una ventana de 390 × 844 WHEN se abre la página THEN el titular, la frase y el botón se ven sobre el fondo sin desplazar
- [x] F3 Implementar «Cómo funciona» con foto por paso, «Cadenas de tres» y la lista de espera sobre fotografía, y verificar que pasan las pruebas de T3 de las secciones. ref: Secciones con fotografía · est: 4h · disc: front
  - GIVEN la lista de espera en tema oscuro WHEN se analiza con axe THEN no hay infracciones de contraste

## 4. App

- [x] T4 Escribir las pruebas de componente, en los dos temas, de `AmbientBackdrop` (decorativo; una sola imagen fija con movimiento reducido), la bienvenida y `AuthLayout` (franja en compacto, dos columnas en ancho), la variante `onPhoto` de `Button`, `EmptyState` con imagen y los estados vacíos de Explorar, Matches y Mis casas. Comprobar que fallan. ref: Fotografía de ambiente en la bienvenida y el acceso · est: 4h · disc: qa
  - GIVEN «reducir movimiento» activado WHEN se muestra la bienvenida THEN hay una sola imagen y ninguna animación
- [x] F4 Implementar `AmbientBackdrop`, la variante `onPhoto`, la bienvenida, `AuthLayout` en acceso y recuperar contraseña, y `EmptyState` con imagen en los tres estados vacíos, y verificar que pasan las pruebas de T4. ref: Estados vacíos con imagen · est: 6h · disc: front
  - GIVEN un usuario sin matches WHEN abre «Matches» THEN ve la imagen de ambiente, el motivo y la acción de explorar
- [x] T5 Escribir las pruebas de la navegación (fondo activo `surfaceMuted` en las dos disposiciones y estado seleccionado anunciado), del aviso de verificación compacto (mensaje y dos acciones en una franja; resultado anunciado) y de `feedMinHeight` y la fila de filtros desplazable. Comprobar que fallan. ref: Tarjetas a pantalla completa · est: 3h · disc: qa
  - GIVEN una ventana de 844 px de alto y 300 px de controles WHEN se calcula la altura de la tarjeta THEN cabe sin desplazar y no baja del mínimo legible
- [x] F5 Implementar la navegación legible, el aviso de verificación compacto, la altura de la tarjeta y la fila de filtros desplazable, y verificar que pasan las pruebas de T5. ref: Aviso de verificación compacto · est: 4h · disc: front
  - GIVEN un email sin verificar WHEN se abre «Explorar» THEN el aviso ocupa una franja y la tarjeta se ve entera

## 5. Verificación

- [ ] Q1 Ejecutar la puerta de calidad completa (lint, typecheck, test:coverage, build, E2E de la landing y de la app web) y revisar a mano capturas de la landing y la app en los dos temas y en 390 × 844 y 1440 × 900. ref: Navegación principal legible · est: 3h · disc: qa
  - GIVEN la rama del change WHEN se ejecuta la puerta THEN todo pasa con cobertura ≥ 80 %

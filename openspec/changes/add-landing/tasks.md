# Tasks

## 1. Contenido y propuesta de valor

- [ ] T1 Escribir las pruebas de contenido y renderizado de la página principal (héroe, tres pasos, cadenas, ventajas, fundador, FAQ y ausencia de «ahorro fiscal») y comprobar que fallan. ref: Presentación de la propuesta de valor · est: 3h · disc: qa
  - GIVEN los textos de `src/i18n/es.ts` WHEN se ejecuta la prueba de RN-07 THEN falla si algún texto contiene «ahorro fiscal»
  - GIVEN la página principal renderizada WHEN se cuentan los pasos de «Cómo funciona» THEN hay exactamente tres
- [ ] L1 Implementar las secciones de la página principal con los textos en `src/i18n/es.ts` y verificar que pasan las pruebas de T1. ref: Presentación de la propuesta de valor · est: 5h · disc: front
  - GIVEN la página principal WHEN se renderiza THEN el botón del héroe enlaza a `#lista-de-espera`
- [ ] L2 Implementar las preguntas frecuentes con `<details>`/`<summary>` y verificar en la prueba de renderizado que cada pregunta expone su respuesta. ref: Presentación de la propuesta de valor · est: 2h · disc: front
  - GIVEN una pregunta frecuente WHEN se activa THEN su respuesta queda visible y el estado expandido es accesible

## 2. Páginas legales

- [ ] T2 Escribir las pruebas del pie (cuatro enlaces legales en todas las páginas) y del aviso de borrador, y comprobar que fallan. ref: Páginas legales · est: 1h · disc: qa
  - GIVEN cualquier página WHEN se renderiza el pie THEN contiene enlaces a aviso legal, privacidad, cookies y términos
- [ ] L3 Crear las cuatro páginas legales con estructura y texto marcado como borrador, enlazarlas en el pie y verificar que pasan las pruebas de T2. ref: Páginas legales · est: 3h · disc: front
  - GIVEN una página legal en borrador WHEN se muestra THEN incluye el aviso «Borrador pendiente de revisión jurídica»

## 3. Consentimiento de cookies

- [ ] T3 Escribir las pruebas unitarias del módulo de consentimiento (sin decisión no se guarda nada salvo la propia decisión, aceptar, rechazar, cambiar, notificar el cambio) y comprobar que fallan. ref: Consentimiento de cookies · est: 2h · disc: qa
  - GIVEN ninguna decisión previa WHEN se consulta el consentimiento THEN el resultado es «sin decidir» y no hay datos guardados
  - GIVEN una decisión de rechazo WHEN se recarga THEN el consentimiento sigue siendo «rechazado»
- [ ] L4 Implementar `src/lib/consent.ts` y el aviso de cookies con «Aceptar», «Rechazar» y «Configurar» al mismo nivel, el enlace «Configurar cookies» del pie y el enganche de analítica condicionado, y verificar que pasan las pruebas de T3. ref: Consentimiento de cookies · est: 4h · disc: front
  - GIVEN el aviso visible WHEN se renderiza THEN «Aceptar» y «Rechazar» tienen la misma jerarquía visual

## 4. Accesibilidad, temas y SEO

- [ ] T4 Configurar Playwright con `axe-core` en `apps/landing` (`pnpm test:e2e`) y escribir las pruebas E2E de teclado, tema oscuro, 320 px sin desplazamiento horizontal y cookies antes de decidir; comprobar que fallan donde falta implementación. ref: Accesibilidad, temas y adaptación a pantalla · est: 3h · disc: qa
  - GIVEN la página a 320 px WHEN se mide el documento THEN su ancho de desplazamiento no supera el de la ventana
  - GIVEN una visita nueva WHEN carga la página THEN el navegador no tiene cookies ni almacenamiento no esencial
- [ ] L5 Ajustar estilos y foco hasta que las pruebas E2E y `axe-core` pasen sin infracciones en claro y oscuro. ref: Accesibilidad, temas y adaptación a pantalla · est: 3h · disc: front
  - GIVEN la página en tema oscuro WHEN se analiza con axe-core THEN no hay infracciones de contraste
- [ ] T5 Escribir las pruebas de metadatos por página y de `sitemap`/`robots.txt` sobre el sitio construido y comprobar que fallan. ref: Descubrimiento en buscadores · est: 1h · disc: qa
  - GIVEN el sitio construido WHEN se lee `robots.txt` THEN referencia el mapa del sitio
- [ ] L6 Añadir el componente de SEO, la imagen para compartir, la integración de sitemap y `robots.txt`, y verificar que pasan las pruebas de T5. ref: Descubrimiento en buscadores · est: 2h · disc: front
  - GIVEN cualquier página WHEN se inspecciona su `<head>` THEN tiene `title`, `description` y `og:image` propios

## 5. Integración

- [ ] V1 Ejecutar `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage`, `pnpm test:e2e` y `pnpm build` desde la raíz y verificar que todo pasa con cobertura ≥ 80 %. ref: Accesibilidad, temas y adaptación a pantalla · est: 1h · disc: qa
  - GIVEN el change implementado WHEN se ejecuta la puerta de calidad local THEN todos los comandos terminan con éxito

## Workflow follow-up

- `/opsx:verify`, `/opsx:sync` y `/opsx:archive` tras la implementación.

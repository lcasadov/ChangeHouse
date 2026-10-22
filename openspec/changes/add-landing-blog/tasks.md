# Tasks

## 1. Guías

- [ ] T1 Escribir las pruebas de la colección de guías (orden, borradores excluidos en producción, ausencia de «ahorro fiscal» en todos los artículos) y de renderizado del listado y del artículo, y comprobar que fallan. ref: Guías publicadas · est: 2h · disc: qa
  - GIVEN una guía en borrador WHEN se construye en modo producción THEN no genera página
- [ ] F1 Implementar la colección `guias`, las plantillas de listado y artículo con índice, tiempo de lectura y llamada a la lista de espera, y las tres guías iniciales en borrador revisable, y verificar que pasan las pruebas de T1. ref: Guías publicadas · est: 5h · disc: front
  - GIVEN una guía publicada WHEN se abre THEN muestra su índice de secciones
- [ ] T2 Escribir las pruebas de metadatos, datos estructurados, mapa del sitio y RSS sobre el sitio construido, y comprobar que fallan. ref: Guías encontrables · est: 1h · disc: qa
  - GIVEN el sitio construido WHEN se lee `/guias/rss.xml` THEN incluye las guías publicadas
- [ ] F2 Implementar los metadatos por artículo, los datos estructurados `Article`, la inclusión en el sitemap y el feed RSS, y verificar que pasan las pruebas de T2. ref: Guías encontrables · est: 2h · disc: front
  - GIVEN una guía WHEN se inspecciona su `<head>` THEN contiene el JSON-LD de tipo `Article`

## 2. Integración

- [ ] V1 Ejecutar `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage`, `pnpm test:e2e` y `pnpm build` y verificar que todo pasa con cobertura ≥ 80 %. ref: Guías publicadas · est: 1h · disc: qa
  - GIVEN el change implementado WHEN se ejecuta la puerta de calidad local THEN todos los comandos terminan con éxito

## Workflow follow-up

- `/opsx:verify`, `/opsx:sync` y `/opsx:archive` tras la implementación.

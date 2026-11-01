# Design

## Context

La landing (Astro) y la app (Expo, también en web) usan los tokens de
`packages/ui`. El problema no son los colores sino la composición:
- casi no hay fotografía;
- la primera pantalla de la landing es texto sobre blanco;
- la bienvenida y el acceso son formularios planos;
- en la barra lateral, la sección activa sale con el azul por defecto de React
  Navigation y el texto coral;
- en «Explorar», el aviso de verificación y la búsqueda empujan la tarjeta fuera
  de la pantalla;
- los datos de demostración (`scripts/seed-demo.mjs`) dibujan una casa plana con
  texto encima.

No hay banco de imágenes ni licencias contratadas, y el usuario pidió crear las
imágenes de prueba. En el equipo hay sharp; no hay ffmpeg instalado.

## Goals / Non-Goals

**Goals**
- Una primera impresión fotográfica y en movimiento en la landing, sin perder
  WCAG 2.2 AA, rendimiento ni la CSP actual.
- Una app más amable en sus primeros pasos y en las pantallas de uso diario.
- Imágenes de prueba variadas y reproducibles para la landing, la app y la
  semilla.

**Non-Goals**
- Cambiar la paleta de marca, la tipografía o los textos de producto.
- Vídeo en la app nativa: añadiría `expo-video` y una compilación nativa. La app
  usa fotografía con fundidos.
- Fotos de stock ni imágenes generadas por servicios externos.

## Decisions

- **Generador de escenas propio** (`scripts/media/scenes.mjs`):
  - Funciones que componen SVG y sharp rasteriza a JPEG.
  - Escenas: fachada mediterránea con piscina, bloque clásico con balcones,
    casa moderna al anochecer, ático con terraza sobre los tejados, salón,
    cocina y dormitorio.
  - Cada escena admite una paleta (fachada, acento y hora del día) y una semilla,
    así que dos casas de la semilla nunca salen iguales.
  - El resultado es determinista: misma semilla, mismo fichero.
  - *Alternativa descartada:* fotos de stock, que exigen licencia y atribución y
    no se pueden variar por casa.
- **Recursos versionados, generados una vez**:
  - `scripts/media/generate.mjs` escribe la landing (`apps/landing/public/media/`)
    y la app (`apps/mobile/assets/ambient/`).
  - Se versionan los resultados, no se generan en CI.
  - El vídeo se codifica con el ffmpeg de `FFMPEG_PATH` o del `PATH`. Si no hay
    ninguno, el script avisa y genera solo las imágenes.
  - Presupuesto:
    - vídeo de 1280 × 720, WebM VP9 y MP4 H.264, de ≤ 3 MB cada uno;
    - imagen fija de ≤ 250 KB;
    - fotos de sección de ≤ 200 KB.
- **Vídeo del héroe**:
  - *Forma:* `<video muted loop playsinline preload="none" poster>`, sin
    `autoplay`, con `aria-hidden="true"` y dos `<source>` (WebM y MP4).
  - *Arranque:* el módulo `src/lib/hero-video.ts` decide si se reproduce, con la
    función pura `shouldAutoplay({ reducedMotion, saveData })`. Si se reproduce,
    llama a `play()`; si no, deja la imagen fija.
  - *Sin JavaScript* solo se ve la imagen fija, que es el caso seguro.
  - *Control:* un `<button aria-pressed>` en la esquina, «Pausar el vídeo de
    fondo» / «Reproducir el vídeo de fondo», de al menos 44 px y siempre visible
    (WCAG 2.2.2).
  - *Mensajes:* los textos están en `i18n/es.ts`.
  - *Fallo:* si `play()` falla (política del navegador), se queda la imagen fija
    y el control ofrece reproducir.
- **Velo sobre la fotografía**: el token nuevo `color.photoVeil`, de
  `rgba(12,16,28,0.58)` en los dos temas.
  - Va sobre toda la superficie del héroe, de «Cadenas de tres» y de la lista de
    espera, junto con el degradado `photoScrim*` en la base.
  - El blanco sobre el velo alcanza al menos 4,5:1 incluso sobre un píxel blanco
    puro: la mezcla da un gris máximo de unos `#6E7076`, y el blanco sobre él da
    unos 4,9:1.
  - Lo verifica una prueba de `contrast.ts`.
- **Cabecera superpuesta**:
  - `Header` admite `overlay`; la página principal lo usa.
  - Sobre el héroe es transparente, con texto `textOnPhoto`.
  - Al desplazarse pasa a la superficie del tema, con una clase que añade un
    `IntersectionObserver` sobre el héroe. Sin JavaScript se queda sobre el velo
    y sigue siendo legible.
- **Secciones con fotografía**:
  - Las fotos de «Cómo funciona» son `<img loading="lazy" decoding="async">` con
    `alt`.
  - «Cadenas de tres» y la lista de espera usan un `<img>` decorativo (`alt=""`)
    posicionado detrás del contenido, en lugar de `background-image`, para poder
    usar la carga diferida.
  - El formulario de la lista de espera va sobre `color.surface` con un 94 % de
    opacidad y `backdrop-filter` (tarjeta translúcida), para que el contraste del
    formulario no dependa de la foto.
- **App, fotografía de ambiente**:
  - **`AmbientBackdrop`** (en `src/ui`) apila de 1 a 3 imágenes de `expo-image`
    con un fundido cruzado cada 7 s y un zoom de 1 → 1,08, ambos con
    Reanimated. Debajo van el velo `photoVeil` y el degradado `photoScrim*`.
  - Con `useReduceMotion()` muestra solo la primera, fija.
  - Es decorativo: `accessibilityElementsHidden` e
    `importantForAccessibility="no-hide-descendants"`.
  - **Bienvenida:** `AmbientBackdrop` a pantalla completa, con el texto en
    `textOnPhoto`.
  - **Variante de botón `onPhoto`**: fondo `textOnPhoto` y texto `secondary`, de
    14,3:1; el secundario es `ghost` con texto `textOnPhoto`.
  - **`AuthLayout`**, para acceso y recuperar contraseña:
    - en `compact` y `medium`, una franja superior de 180 px con la foto y el
      título encima;
    - en `expanded`, dos columnas: foto a la izquierda, al 50 %, y formulario a
      la derecha, con el ancho de lectura.
- **Navegación**:
  - `tabBarActiveBackgroundColor = color.surfaceMuted` y el texto activo en
    `primary`. El contraste entre ambos colores, en los dos temas, lo verifica
    `contrast.ts`.
  - Al pasar `tabBarActiveBackgroundColor` en las dos disposiciones se elimina el
    azul por defecto.
  - En la barra lateral, los elementos llevan `radius.md`.
- **Aviso de verificación**:
  - Usa `Notice` en tono `warning`, con el mensaje y una fila de dos `Link`:
    reenviar y comprobar.
  - El resultado (enviado, aún pendiente o fallo) sustituye al mensaje dentro del
    mismo aviso y se anuncia con `announce`.
  - El botón grande desaparece.
- **Explorar entera en pantalla**:
  - La altura de la tarjeta se limita con `cardHeightFor(viewportHeight,
    chromeHeight)`: una función pura que resta lo que ocupan la búsqueda, los
    filtros y los botones de decisión, y fija un mínimo legible.
  - La proporción de la foto pasa de 4:5 fija a ser la que quepa, con un máximo
    de 4:5.
  - Los chips de filtro van en un `ScrollView` horizontal.
- **`EmptyState` con imagen**: admite `image` (una fuente de `expo-image`), que
  sustituye al icono por una foto redondeada de 160 px y decorativa. La usan fin
  de Explorar, sin matches y sin casas.
- **Semilla de demostración**: `seed-demo.mjs` importa `scenes.mjs` y sube a
  cada casa cuatro fotos (exterior, salón, cocina y dormitorio). Las fotos usan
  la paleta y la hora del día de la persona.

## Risks / Trade-offs

- **Peso del vídeo:** limitado a ≤ 3 MB, con `preload="none"` y ahorro de datos
  respetado. La imagen fija se carga con prioridad.
- **Escenas generadas, no fotos reales:** son ilustraciones fotorrealistas
  sencillas, no fotografía. Bastan para probar y para la demo; antes del
  lanzamiento se pueden sustituir por fotos reales con el mismo nombre de fichero.
- **Binarios en el repositorio:** unos 7 MB en total, aceptable. Se regeneran con
  un comando documentado.
- **`backdrop-filter`:** donde no se admite, la tarjeta queda con su color al
  94 %, que sigue siendo legible.

## Migration Plan

Solo cambian componentes y recursos estáticos: no hay migraciones ni cambios de
API. Quien ya tenga datos de demostración los rehace desde cero (apartado
«Empezar de cero» de `docs/desarrollo-local.md`) para ver las fotos nuevas.

## Open Questions

Ninguna. Las decisiones abiertas se resolvieron con la opción recomendada:
- vídeo solo en la landing;
- escenas propias en lugar de fotos de stock;
- recursos versionados.

# Proposal

## Why

Al probar la app en local, el usuario valoró el diseño como «muy malo» y pidió uno
rompedor, más amable y que atraiga a quien llega. Los problemas concretos son
cinco:

- **Landing:** la primera pantalla es texto sobre blanco con una ilustración
  pequeña.
- **Bienvenida y acceso:** son formularios planos.
- **Menú lateral:** la sección activa se pinta con fondo azul y texto coral, que
  apenas se lee.
- **Explorar:** el aviso de verificación del email ocupa media pantalla y la
  tarjeta queda cortada por abajo.
- **Datos de demostración:** las fotos son dibujos planos con texto encima.

Es el momento de corregirlo, antes de enseñar la app a nadie.

## What Changes

- **Landing**:
  - **Héroe:** a pantalla completa, con un vídeo de fondo silencioso en bucle
    (casas que se suceden). Lleva velo para que el texto se lea, botón de pausa
    siempre visible e imagen fija si el visitante pide reducir el movimiento o
    ahorrar datos.
  - **Cabecera:** transparente sobre el héroe.
  - **Secciones con fotografía:** «Cómo funciona» con una foto por paso,
    «Cadenas de tres» sobre una imagen a sangre y la lista de espera sobre una
    imagen con el formulario en una superficie translúcida.
- **App**:
  - **Bienvenida:** fotografías de ambiente a pantalla completa que se suceden
    con un fundido lento.
  - **Acceso:** con fotografía, una franja superior en móvil y un panel lateral
    en web ancha.
  - **Navegación:** la sección activa se marca con fondo suave, texto e icono
    relleno legibles.
  - **Aviso de verificación del email:** compacto, en una sola franja con sus
    dos acciones.
  - **Estados vacíos con imagen:** fin de Explorar, sin matches y sin casas.
  - **Explorar:** la tarjeta cabe entera en pantalla y los filtros van en una
    sola fila desplazable.
- **Imágenes de prueba generadas**:
  - Un generador reproducible crea escenas de viviendas: fachadas, áticos, salón,
    cocina y dormitorio, de día y al atardecer.
  - También crea el vídeo del héroe.
  - Las usan la landing, la app y `pnpm seed:demo`, que sustituye sus dibujos por
    fotos variadas para cada casa.

## Capabilities

### New Capabilities

- `app-experience`: experiencia visual transversal de la app, es decir,
  fotografía de ambiente, navegación principal, avisos persistentes y estados
  vacíos.

### Modified Capabilities

- `landing`: el héroe a pantalla completa con vídeo de fondo accesible y las
  secciones con fotografía.
- `discovery`: la tarjeta de «Explorar» cabe entera en la pantalla y los filtros
  van en una fila.

## Impact

- `apps/landing`:
  - Componentes `Hero`, `Header`, `HowItWorks`, `Chains` y `Waitlist`.
  - Nuevo módulo de control del vídeo.
  - Recursos en `public/media/`.
  - Pruebas unitarias y E2E (axe incluido).
- `apps/mobile`:
  - Bienvenida, acceso, recuperar contraseña, navegación, aviso de verificación,
    `EmptyState`, Explorar y una variante de `Button` para fondos fotográficos.
  - Recursos en `assets/ambient/`.
  - Pruebas de componente en los dos temas.
- `packages/ui`: un token de color para el velo sobre fotos y vídeo, con su
  contraste verificado en el tema claro y en el oscuro.
- `scripts/media/`:
  - Generador de escenas (sharp) y del vídeo (grabado con el Chromium de Playwright, en local y no en CI).
  - Lo usa `scripts/seed-demo.mjs`.
- `docs/style-guide.md` (concepto, token nuevo y componentes) y
  `docs/desarrollo-local.md`.
- Hosting: la CSP de la landing ya permite vídeo propio (`default-src 'self'`);
  no cambia.

**Capacidad principal**: `landing`

## Trazabilidad

| Nivel | Decisión | Motivo |
|---|---|---|
| Epic | existente #18 | Capacidad principal `landing`; relacionadas: `discovery` #150 y la nueva `app-experience` |
| Feature | existente #397 | Issue del rediseño ya creado; pasa a ser la Feature del change |
| Story | nuevo | Una por requisito del spec delta |
| Task | nuevo | Una por línea de `tasks.md` |

| Requirement | Decisión | Story Points | Prioridad |
|---|---|---|---|
| Presentación de la propuesta de valor | nuevo | 3 | P1 |
| Vídeo de fondo del héroe | nuevo | 3 | P1 |
| Secciones con fotografía | nuevo | 2 | P2 |
| Fotografía de ambiente en la bienvenida y el acceso | nuevo | 3 | P1 |
| Navegación principal legible | nuevo | 1 | P1 |
| Aviso de verificación compacto | nuevo | 1 | P2 |
| Estados vacíos con imagen | nuevo | 2 | P3 |
| Tarjetas a pantalla completa | nuevo | 2 | P1 |

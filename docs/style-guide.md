# ChangeHouse — Guía de estilo de la interfaz

> `$STYLE_GUIDE_DOC`. Aplica a la app Expo (Android, iOS y web), al panel de
> administración y a la landing Astro. Los tokens se implementan en
> `packages/ui` (⚠️ aún no existe: los nombres de esta guía son los que **debe**
> usar el código; si al implementarlos cambia alguno, se corrige aquí en el
> mismo cambio).
>
> Fuentes: `docs/project.md` (`$THEMES`, `$A11Y_LEVEL`, `$BROWSER_MATRIX`,
> `$I18N`), README §7 (RNF-40…43) y la identidad de marca
> (`.claude/harness/profile/entregables/formato.md`).

**Regla que gobierna toda la guía: ningún componente usa un valor de color,
espaciado, radio, sombra o tipografía en crudo.** Siempre un token. Un valor en
crudo funciona en el tema en que se escribió y rompe en el otro.

---

## 0 · Concepto de diseño

**Idea fuerza: «el cambio en un vistazo».** Cada pantalla responde en menos de
un segundo a las dos preguntas que importan: *¿me gusta esta casa?* y *¿cuánto me
cuesta el cambio?* Todo lo demás se esconde hasta que hace falta.

| Principio | Cómo se aplica |
|---|---|
| **Foto primero** | Tarjetas a sangre (4:5) con la foto ocupando el 80 % de la pantalla; datos sobre un degradado inferior, nunca en tablas |
| **El dinero, visible y claro** | Píldora de compensación en cada tarjeta: «Tú recibes 12.000 €» (verde), «Tú pagas 8.000 €» (coral) o «Cambio justo» (azul). Es el diferencial del producto |
| **Un gesto, una decisión** | Deslizar o pulsar ♥ / ✕ grandes al alcance del pulgar; deshacer siempre visible durante 5 s; háptica en cada acción |
| **Buscar es escribir un sitio** | Una sola barra «¿Dónde quieres vivir?» con autocompletado y chips de filtro de un toque (dormitorios, m², garaje, ascensor, terraza). El resto, en una hoja inferior |
| **El match se celebra** | Animación de pantalla completa: las casas se deslizan una hacia la otra y se intercambian (en cadena, tres casas en triángulo). Botón directo al chat |
| **Tu casa, tu escaparate** | Alta de vivienda en 5 pasos con progreso, empezando por las fotos; borrador guardado en cada paso |
| **Cero jerga** | Textos cortos en tú; nada de «permuta» sin explicar ni términos fiscales sin ayuda contextual |

**Navegación**: 4 pestañas — *Explorar* · *Matches* (con contador) · *Mis casas* ·
*Perfil*. En web ancha, barra lateral con las mismas cuatro secciones.

**Primer uso en tres pasos** hasta la primera tarjeta: acceso (Google, Apple o
email) → «¿Dónde quieres vivir y cuánto puedes compensar?» → tarjetas. Publicar la
vivienda se ofrece después, con un aviso persistente: sin vivienda publicada no
hay matches.

**Lenguaje visual**: coral intenso y azul noche, esquinas muy redondeadas
(`radius.lg`), titulares grandes en Inter 800, superficies translúcidas sobre las
fotos, degradado coral → rosa reservado a los momentos de match, microanimaciones
con Reanimated (≤ 320 ms y respetando «reducir movimiento»).

**Landing**: héroe con la animación de dos casas que se intercambian, la promesa
«Cambia de casa sin vender primero», el formulario de lista de espera en la
primera pantalla, «Cómo funciona» en tres pasos y una sección propia para las
cadenas de tres.

## 1 · Fundamentos de diseño (tokens)

Nomenclatura: `categoria.rol[.variante]`, accesibles en código como
`theme.color.primary`, `theme.space[4]`, etc. Los temas solo cambian **valores**,
nunca nombres.

### Color

Paleta base de marca: coral `#E8505B` y azul marino `#1F2A44`. El coral de
marca **no alcanza 4,5:1 con texto blanco** (3,67:1), así que los botones y
textos usan una variante oscurecida; el coral de marca queda para logotipo,
ilustraciones y elementos no textuales grandes.

| Token | Propósito | Claro | Oscuro | Contraste verificado |
|---|---|---|---|---|
| `color.bg` | Fondo de pantalla | `#FFFFFF` | `#121826` | — |
| `color.surface` | Tarjetas, hojas | `#FFFFFF` | `#1A1F2B` | — |
| `color.surfaceMuted` | Fondos secundarios, filas alternas | `#FDEEEF` | `#232A38` | — |
| `color.text` | Texto principal | `#3A3A3A` | `#E6E8EC` | 11,4:1 · 14,5:1 |
| `color.textMuted` | Texto secundario | `#5A6672` | `#8A94A3` | 5,9:1 · 5,4:1 |
| `color.textOnPrimary` | Texto sobre `primary` | `#FFFFFF` | `#121826` | 5,3:1 · 7,1:1 |
| `color.primary` | Acción principal, enlaces | `#C8323E` | `#FF7A84` | 5,3:1 · 7,1:1 |
| `color.primaryPressed` | Estado activo | `#B42A35` | `#FF959D` | ≥ 4,5:1 |
| `color.brand` | Logotipo e ilustración (no texto) | `#E8505B` | `#E8505B` | no textual |
| `color.secondary` | Cabeceras, navegación | `#1F2A44` | `#A9B1BD` | 14,3:1 · 8,2:1 |
| `color.border` | Separadores y bordes decorativos (no de controles) | `#D9DDE3` | `#2E3646` | decorativo |
| `color.borderStrong` | Borde de controles: campos, casillas, interruptores | `#7A8594` | `#8A94A3` | ≥ 3:1 sobre `bg` y `surface` (WCAG 1.4.11) |
| `color.focus` | Anillo de foco | `#1D4ED8` | `#3B82F6` | 6,7:1 · 4,8:1 |
| `color.success` | Confirmación | `#1E7D4F` | `#4ADE80` | 5,1:1 · 10,2:1 |
| `color.warning` | Aviso | `#B54708` | `#FBBF24` | 5,4:1 · 10,6:1 |
| `color.danger` | Error, acción destructiva | `#B42A35` | `#FF7A84` | 6,3:1 · 7,1:1 |
| `color.compensationReceive` | Píldora «Tú recibes» | `#1E7D4F` | `#4ADE80` | 5,1:1 · 10,2:1 |
| `color.compensationPay` | Píldora «Tú pagas» | `#C8323E` | `#FF7A84` | 5,3:1 · 7,1:1 |
| `color.compensationEven` | Píldora «Cambio justo» | `#1D4ED8` | `#3B82F6` | 6,7:1 · 4,8:1 |
| `color.matchGradientStart` / `matchGradientEnd` | Degradado de los momentos de match (no textual) | `#E8505B` → `#F472B6` | `#E8505B` → `#F472B6` | no textual |
| `color.photoScrimStart` / `photoScrimEnd` | Degradado inferior sobre fotos para texto blanco | `rgba(0,0,0,0)` → `rgba(0,0,0,0.72)` | ídem | texto blanco ≥ 4,5:1 sobre el tramo final |
| `color.overlay` | Velo de diálogos | `rgba(18,24,38,0.5)` | `rgba(0,0,0,0.6)` | — |

Contrastes calculados con la fórmula de WCAG 2.2 sobre `color.bg` del tema
(o sobre `primary` para `textOnPrimary`).

### Tipografía

Familia: **Inter** (libre, licencia SIL OFL), cargada con `expo-font` en la app
y desde Google Fonts o empaquetada en la landing. Respaldo: la fuente del
sistema (San Francisco en iOS, Roboto en Android). Las plantillas Word siguen
con Calibri: son documentos, no interfaz.

| Token | Uso | Tamaño / interlineado | Peso |
|---|---|---|---|
| `font.display` | Titular de la landing | 40 / 48 | 700 |
| `font.title` | Título de pantalla | 24 / 32 | 700 |
| `font.heading` | Encabezado de sección | 20 / 28 | 600 |
| `font.body` | Texto general | 16 / 24 | 400 |
| `font.bodyStrong` | Énfasis | 16 / 24 | 600 |
| `font.label` | Etiquetas de formulario y botones | 14 / 20 | 600 |
| `font.caption` | Texto auxiliar, metadatos | 12 / 16 | 400 |

Todos los tamaños respetan el escalado de texto del sistema (Dynamic Type en
iOS, tamaño de fuente en Android): **ninguna pantalla puede romperse al 200 %**.

### Espaciado

Escala de 4 px: `space[1]` = 4, `space[2]` = 8, `space[3]` = 12, `space[4]` = 16,
`space[5]` = 24, `space[6]` = 32, `space[7]` = 48, `space[8]` = 64.

### Radios

`radius.sm` = 6 (campos), `radius.md` = 12 (botones, tarjetas pequeñas),
`radius.lg` = 20 (tarjetas de vivienda, hojas), `radius.full` = 9999 (avatares,
chips).

### Sombras y elevación

| Token | Uso | Claro | Oscuro |
|---|---|---|---|
| `elevation.0` | Plano | sin sombra | sin sombra |
| `elevation.1` | Tarjetas | sombra suave | borde `color.border` en lugar de sombra |
| `elevation.2` | Tarjeta de descubrimiento en arrastre, menús | sombra media | borde + superficie más clara |
| `elevation.3` | Diálogos, hojas inferiores | sombra fuerte | superficie más clara + velo |

Los valores concretos de sombra se definen por plataforma en `packages/ui`
(iOS `shadow*`, Android `elevation`, web `box-shadow`).

### Medidas de disposición

| Token | Valor | Uso |
|---|---|---|
| `touchTarget` | 44 | Tamaño mínimo de cualquier objetivo táctil |
| `borderWidth` | 1 (fino) · 2 (foco y selección) | Grosor de bordes |
| `contentMaxWidth.reading` / `.card` | 720 / 480 | Ancho máximo de texto y de la tarjeta de descubrimiento |
| `breakpoints.medium` / `.expanded` | 600 / 1024 | Puntos de corte de §4 |
| `disabledOpacity` | 0,5 | Opacidad de controles deshabilitados (siempre acompañada de otro indicador) |

Los valores concretos de sombra de `elevation.*` viven en `packages/ui/src/tokens/elevation.ts`; en oscuro, `elevation.3` usa una superficie más clara en lugar de sombra.

### Movimiento

`motion.fast` 120 ms, `motion.base` 200 ms, `motion.slow` 320 ms. Con «reducir
movimiento» activado en el sistema, las animaciones de arrastre de tarjetas y
transiciones se sustituyen por fundidos o desaparecen.

## 2 · Temas

| Tema | Predeterminado | Notas |
|---|---|---|
| Claro | **sí** | — |
| Oscuro | — | Sombras sustituidas por bordes y superficies |

- Por defecto se sigue la **preferencia del sistema** (`useColorScheme` en Expo,
  `prefers-color-scheme` en la landing).
- El usuario puede forzar claro u oscuro en Ajustes; la elección se guarda en
  el dispositivo (almacenamiento local) y no viaja a la API. ⚠️ SUPUESTO: el
  README solo exige seguir la preferencia del sistema.
- **Todo componente se prueba en los dos temas** (prueba de componente
  parametrizada por tema).

## 3 · Catálogo de componentes

Estados obligatorios para todo componente interactivo: reposo, foco, activo,
deshabilitado, cargando y error. Para los que muestran datos: **vacío**.

| Componente | Cuándo usarlo | Cuándo no | Variantes | Estados clave |
|---|---|---|---|---|
| `Button` | Acción explícita | Navegación pura (usa `Link`) | `primary`, `secondary`, `ghost`, `danger` | cargando: bloquea doble pulsación y mantiene el ancho |
| `IconButton` | Acción frecuente con icono reconocible | Acciones sin icono universal | `default`, `danger` | siempre con etiqueta accesible |
| `Link` | Navegación | Acciones que cambian datos | — | foco visible |
| `TextField` | Entrada de texto | Selección entre pocas opciones | `text`, `email`, `phone`, `number`, `money` | error junto al campo |
| `Select` / `SegmentedControl` | 2–7 opciones (segmentado), más opciones (select) | — | — | — |
| `Checkbox`, `Switch` | Booleano; `Switch` aplica al instante | — | — | — |
| `MoneyRangeField` | Rango de valor y compensaciones (RF-12, RF-32) | Importes sueltos | — | valida mín ≤ máx |
| `AddressAutocomplete` | Dirección con Google Places | — | — | sin resultados, error de red |
| `PhotoPicker` | Fotos de la vivienda (3–20) | — | — | subiendo con progreso, error por foto, mínimo no alcanzado |
| `HomeCard` | Tarjeta de descubrimiento | Listados densos (usa `HomeListItem`) | `discover`, `compact` | cargando (esqueleto) |
| `SwipeDeck` | Descubrimiento | — | — | **vacío** («no hay más viviendas compatibles»: sugiere ampliar zona o compensación), cargando, error |
| `MatchCard` | Match en la lista | — | `direct`, `chain` | pendiente de tu confirmación, retirado, caducado |
| `CompensationSummary` | Quién paga a quién en un match | — | — | siempre con el aviso «estimación orientativa» |
| `ChatThread`, `MessageBubble` | Chat del match | — | propio, ajeno, sistema | enviando, fallido con reintento |
| `Badge`, `Chip` | Estado o filtro | Acciones | `neutral`, `success`, `warning`, `danger` | — |
| `EmptyState` | Lista o pantalla sin datos | — | — | explica por qué y qué hacer |
| `ErrorState` | Fallo de carga | — | — | qué ha pasado + botón de reintentar |
| `Skeleton` | Carga inicial > 300 ms | Cargas < 300 ms | — | — |
| `Toast` | Confirmación efímera | Errores que requieren acción | `success`, `info`, `error` | anunciado a lectores de pantalla |
| `Dialog`, `BottomSheet` | Confirmación o tarea breve | Formularios largos | — | foco atrapado y devuelto al cerrar |
| `DataTable` | Panel de administración (web) | Móvil (usa lista) | — | vacío, cargando, paginación |

Etiqueta del estado de una vivienda (`HomeStatus`) y de un match
(`MatchStatus`): siempre texto + icono, nunca solo color.

## 4 · Composición y disposición

| Punto de corte | Ancho | Disposición |
|---|---|---|
| `compact` | < 600 | Una columna, navegación inferior por pestañas |
| `medium` | 600–1023 | Una o dos columnas; tarjeta de descubrimiento centrada con ancho máximo |
| `expanded` | ≥ 1024 | Navegación lateral; panel de administración con tablas |

- Ancho máximo de contenido de lectura: 720 px; de la tarjeta de
  descubrimiento: 480 px.
- Márgenes laterales: `space[4]` en `compact`, `space[6]` en adelante.
- Respetar las zonas seguras (`SafeAreaView`) en móvil.
- **Tablas en pantalla estrecha**: el panel de administración pasa de tabla a
  lista de tarjetas por debajo de `expanded`; nunca desplazamiento horizontal de
  la página.
- **Formularios largos** (alta de vivienda): divididos en pasos con progreso
  visible y borrador guardado en el servidor (estado `draft`) para no perder
  datos.
- Objetivos táctiles de al menos 44 × 44 pt.

## 5 · Retroalimentación al usuario

| Situación | Mecanismo |
|---|---|
| Acción completada sin consecuencias (guardar preferencias) | `Toast` de éxito |
| Error de validación | Mensaje en línea junto al campo |
| Error de carga de una pantalla | `ErrorState` con reintento |
| Acción destructiva o irreversible (retirarse de un match, eliminar cuenta, eliminar foto) | `Dialog` de confirmación que **nombra** lo que se destruye y sus consecuencias («Si te retiras, el match se cerrará para los 3 participantes») |
| Operación > 300 ms | Indicador de progreso o `Skeleton` |
| Nuevo match | Pantalla de celebración + notificación push |
| Sin conexión | Banner persistente; las acciones quedan deshabilitadas, no fallan en silencio |

Todo error dice **qué hacer a continuación**: «No hemos podido subir la foto.
Comprueba tu conexión y vuelve a intentarlo», no «Error 500».

## 6 · Formularios

- Validación **al salir del campo** y al enviar; nunca mientras se escribe,
  salvo para quitar un error ya mostrado.
- El error aparece debajo del campo, con icono y texto, y se asocia al campo
  para los lectores de pantalla.
- Los obligatorios son la norma; se marcan los **opcionales** («(opcional)»).
- Mismos esquemas Zod en la app y en la API (`packages/shared`): React Hook
  Form + Zod.
- Prevención de doble envío: botón en estado cargando y deshabilitado hasta la
  respuesta.
- Importes con teclado numérico, formato `es-ES` al mostrar y céntimos al
  enviar.
- Sin valores por defecto que el usuario pueda aceptar sin darse cuenta en
  datos que afectan al matching (valor, compensaciones, requisitos VPP).

## 7 · Accesibilidad (WCAG 2.2 AA)

- Contraste ≥ 4,5:1 para texto normal y ≥ 3:1 para texto grande y controles,
  **en los dos temas** (ver tabla de color).
- Toda la funcionalidad es alcanzable con teclado en la web y con lectores de
  pantalla (VoiceOver, TalkBack) en móvil; foco siempre visible con
  `color.focus`.
- **El descubrimiento tipo swipe tiene alternativa sin gestos**: botones
  visibles de «Me gusta», «Descartar» y «Ver detalle» (WCAG 2.5.1, 2.5.7).
- Todo control tiene etiqueta accesible (`accessibilityLabel` / `aria-label`);
  las fotos de vivienda tienen texto alternativo descriptivo («Salón, foto 2 de
  8»).
- Los cambios dinámicos (nuevo match, toast, error) se anuncian
  (`accessibilityLiveRegion`, `aria-live`).
- El color nunca es el único portador de información.
- Respeto del escalado de texto y de «reducir movimiento».

## 8 · Idioma y contenido

- **Idioma**: español de España (`es-ES`) en el MVP; preparado para inglés.
  **Ningún texto visible se escribe en el código**: todo pasa por el sistema de
  i18n (⚠️ librería pendiente, `$I18N`).
- **Tratamiento**: tú. Tono cercano y claro, sin jerga inmobiliaria ni fiscal
  sin explicar.
- **Mayúsculas**: solo la inicial de la frase en títulos y botones («Publicar
  vivienda», no «Publicar Vivienda»).
- **Fechas**: `18 oct 2026` en listados, `18 de octubre de 2026` en detalle;
  horas en 24 h.
- **Números y moneda**: `250.000 €` (separador de miles con punto, símbolo
  detrás con espacio), superficies `85 m²`.
- **Mensajes fiscales**: siempre «estimación orientativa»; nunca se sugiere un
  valor de escritura (RN-07) ni se habla de «ahorro fiscal».
- Vocabulario de producto: «Me gusta», «Descartar», «match», «match en cadena»,
  «permuta», «compensación».

---

## Deuda de estilo

Ninguna: no hay código todavía.

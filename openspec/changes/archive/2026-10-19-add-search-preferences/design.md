# Design

## Context

Las viviendas existen con municipio y punto en PostGIS (`add-home-listing`) y
pasan por moderación (`add-home-moderation`). El contrato ya declara las cinco
operaciones de preferencias y el esquema `SearchPreferences`; el modelo de datos
define `search_preferences`. El descubrimiento (`add-discovery-feed`) consumirá
las preferencias efectivas. Motivación en `proposal.md`.

## Decisions

- **Una tabla, dos ámbitos**: `search_preferences` con `home_id` nulo para las
  del usuario y relleno para las de una vivienda. Unicidad con dos índices
  únicos parciales: `(user_id) WHERE home_id IS NULL` y `(home_id) WHERE home_id
  IS NOT NULL`. Borrar la vivienda borra sus preferencias (`CASCADE`).
- **Zona**: `municipalities` (texto normalizado, comparado sin tildes ni
  mayúsculas con `homes.municipality`) o `center` + `radiusKm` (columna
  `geography(Point)`; `radius_km` 0 < r ≤ 200). Se exige al menos un municipio
  o el par centro y radio; un centro sin radio o un radio sin centro es 400
  (forma) y la ausencia de zona es 422 `SEARCH_PREFERENCES_INCOMPLETE` (regla),
  como pide el spec.
- **Validación compartida**: esquema Zod `SearchPreferences` en
  `packages/shared`, usado por la API y por la app; `valueReferencePct` por
  defecto 50.
- **Preferencias efectivas**: caso de uso `resolveEffectivePreferences(homeId)`
  = las de la vivienda si existen; si no, las del usuario; si no hay ninguna,
  `null`. Lo usará el descubrimiento; aquí se prueba con su propia prueba.
- **Sustitución completa**: `PUT` reemplaza el documento entero (no fusiona);
  las de una vivienda no heredan campos de las del usuario.
- **Vivienda ajena o inexistente** → 404 en las tres operaciones de vivienda,
  igual que `getHome`; `agency` y `admin` → 403 por la política.
- **`move_date`** del modelo de datos queda fuera: no está en el contrato.
- **App, «Explorar»**:
  - Barra superior «¿Dónde quieres vivir?»: autocompletado sobre el puerto
    `AddressSuggestions` existente (lugares de prueba sin clave). Elegir un
    municipio lo añade a `municipalities`; elegir un barrio o lugar fija
    `center` en su centro con radio 5 km, ajustable en la hoja.
  - Fila de chips de un toque (Garaje, Ascensor, Exterior, Dormitorios ≥ n,
    Tipo) con `accessibilityState.selected`; cada cambio se guarda con
    *debounce* de 600 ms y deshacer local si la API falla.
  - Hoja inferior «Filtros y compensación» con el resto de filtros, «Puedo
    pagar hasta» y «Quiero recibir al menos» en euros (enviados en céntimos) y
    un control deslizante del punto del rango con una explicación en una
    línea.
  - Primer uso: si `getMySearchPreferences` responde 404, «Explorar» muestra
    un paso a pantalla completa «¿Dónde quieres vivir y cuánto puedes
    compensar?» (zona + dos importes) antes de cualquier tarjeta.
  - Mientras no exista el descubrimiento, debajo de la barra se muestra un
    estado vacío que resume la búsqueda guardada.
- **Detalle de vivienda propia**: entrada «Preferencias de esta vivienda» que
  abre el mismo editor; «Usar las mías» las elimina tras confirmación.

## Risks / Trade-offs

- [Comparar municipios por texto] → se normaliza al guardar y en la consulta;
  cuando haya un catálogo de municipios con código INE se migrará a códigos.
- [Guardado por cada toque] → *debounce* y una sola petición en vuelo; el
  último estado gana.

# ChangeHouse — Modelo de datos

> Motor: PostgreSQL 17 + PostGIS (Cloud SQL). ORM: Drizzle. Migraciones:
> drizzle-kit en `db/migrations`. El chat vive en Cloud Firestore y no forma
> parte de este modelo relacional.
>
> **Aún no hay esquema.** Este documento formaliza el modelo orientativo del
> README §10 con la nomenclatura que ya usa: tablas en inglés, `snake_case` y
> plural. Las decisiones que el README no toma se marcan `⚠️ SUPUESTO` o
> `⚠️ PENDIENTE`, y las anomalías se recogen en «Riesgos detectados» en lugar de
> corregirse en silencio.

---

## 1 · Diagrama entidad-relación

### General

```mermaid
erDiagram
    users ||--o{ homes : "posee"
    users ||--o| search_preferences : "define"
    users ||--o{ consents : "acepta"
    homes ||--o{ home_photos : "tiene"
    homes ||--o{ likes : "da (from)"
    homes ||--o{ likes : "recibe (to)"
    homes ||--o{ dismissals : "descarta"
    matches ||--|{ match_participants : "incluye"
    homes ||--o{ match_participants : "participa"
    users ||--o{ match_participants : "participa"
    matches ||--o| operations : "pasa a"
    agencies ||--o{ operations : "tramita"
    operations ||--o{ documents : "contiene"
    users ||--o{ documents : "sube"
    users ||--o{ reports : "denuncia"
    users ||--o{ audit_log : "actúa"
```

### Cuentas y viviendas

```mermaid
erDiagram
    users {
        uuid id PK
        text firebase_uid UK
        citext email UK
        text display_name
        text phone "privado"
        text municipality
        boolean meets_vpp_requirements
        boolean is_over_65
        kyc_status kyc_status
        user_role role
        timestamptz created_at
        timestamptz deleted_at "borrado lógico"
    }
    homes {
        uuid id PK
        uuid owner_id FK
        home_type type
        home_status status
        home_regime regime
        date vpp_qualification_date
        date vpp_protection_end
        bigint vpp_max_legal_price_cents
        numeric useful_m2
        numeric built_m2
        smallint bedrooms
        smallint bathrooms
        text floor
        boolean has_lift
        boolean garage
        boolean storage_room
        jsonb features
        text energy_rating
        smallint year_built
        bigint value_min_cents
        bigint value_max_cents
        boolean is_primary_residence
        bigint mortgage_outstanding_cents
        bytea exact_address "cifrado"
        geography approx_location
        timestamptz created_at
    }
    home_photos {
        uuid id PK
        uuid home_id FK
        text storage_path
        smallint position
    }
    search_preferences {
        uuid id PK
        uuid user_id FK
        geography areas
        text_array municipalities
        numeric radius_km
        jsonb filters
        bigint max_to_pay_cents
        bigint min_to_receive_cents
        date move_date
    }
    users ||--o{ homes : ""
    homes ||--o{ home_photos : ""
    users ||--o| search_preferences : ""
```

### Grafo de interés y matches

```mermaid
erDiagram
    likes {
        uuid from_home_id PK,FK
        uuid to_home_id PK,FK
        timestamptz created_at
    }
    dismissals {
        uuid home_id PK,FK
        uuid dismissed_home_id PK,FK
        timestamptz created_at
    }
    matches {
        uuid id PK
        smallint type "2 o 3"
        match_status status
        text cycle_key UK "conjunto ordenado de viviendas"
        timestamptz created_at
    }
    match_participants {
        uuid match_id PK,FK
        uuid home_id PK,FK
        uuid user_id FK
        uuid gives_home_id FK
        uuid receives_home_id FK
        bigint compensation_cents
        participant_status status
    }
    matches ||--|{ match_participants : ""
```

### Operación, cumplimiento y captación

```mermaid
erDiagram
    operations {
        uuid id PK
        uuid match_id FK,UK
        uuid agency_id FK
        operation_status status
        timestamptz signed_at
        bigint fee_amount_cents
    }
    agencies {
        uuid id PK
        text name
        text cif UK
        jsonb zones
        jsonb contact
        boolean active
    }
    documents {
        uuid id PK
        uuid operation_id FK
        uuid uploaded_by FK
        document_type type
        text storage_path
    }
    reports {
        uuid id PK
        uuid reporter_id FK
        report_target target_type
        uuid target_id
        text reason
        report_status status
    }
    consents {
        uuid user_id PK,FK
        consent_type type PK
        text version PK
        timestamptz accepted_at
    }
    audit_log {
        bigint id PK
        uuid actor_id FK
        text action
        text entity
        uuid entity_id
        timestamptz at
    }
    waitlist {
        uuid id PK
        citext email UK
        text municipality
        home_type home_type
        text looking_for
        timestamptz consent_at
    }
    agencies ||--o{ operations : ""
    operations ||--o{ documents : ""
```

## 2 · Diccionario de entidades

Tipos de importe: **`bigint` en céntimos de euro** (sufijo `_cents`) —
⚠️ SUPUESTO, ver Riesgos R-1. Identificadores: `uuid` v7 generado en la
aplicación — ⚠️ SUPUESTO, ver §3.

### `users` — persona registrada (propietario, buscador, gestoría o admin)

| Atributo | Tipo | Oblig. | Significado |
|---|---|---|---|
| `id` | uuid | sí | Identificador interno |
| `firebase_uid` | text | sí | UID de Firebase Auth; vincula el token verificado con el usuario |
| `email` | citext | sí | Email de acceso, único sin distinguir mayúsculas |
| `display_name` | text | sí | Nombre visible para otros participantes tras el match |
| `phone` | text | no | Teléfono privado; solo se revela si el usuario lo autoriza (RF-53) |
| `municipality` | text | no | Municipio del perfil (RF-03) |
| `meets_vpp_requirements` | boolean | sí (def. `false`) | Declara cumplir los requisitos de acceso a VPP (RF-33, RN-06) |
| `is_over_65` | boolean | sí (def. `false`) | Para la exención de mayores de 65 del simulador (RF-71) |
| `kyc_status` | enum | sí (def. `none`) | Estado de verificación de identidad (fase 2). ⚠️ PENDIENTE: valores (propuesta `none`, `pending`, `verified`, `rejected`) |
| `role` | enum | sí | `propietario`, `buscador`, `gestoria`, `admin`. Ver Riesgos R-4 |
| `created_at` | timestamptz | sí | Alta |
| `deleted_at` | timestamptz | no | Borrado lógico; los datos personales se anonimizan al borrar (RF-05) |

### `homes` — vivienda publicada o en borrador

| Atributo | Tipo | Oblig. | Significado |
|---|---|---|---|
| `owner_id` | uuid FK → users | sí | Propietario |
| `type` | enum | sí | Piso, ático, dúplex, chalet, adosado… ⚠️ PENDIENTE: lista cerrada |
| `status` | enum | sí | `draft`, `in_review`, `published`, `paused`, `in_operation`, `closed` (RF-17) |
| `regime` | enum | sí | `libre`, `VPPB`, `VPPL`, `VPO` (RF-14) |
| `vpp_qualification_date` | date | si VPP | Fecha de calificación definitiva |
| `vpp_protection_end` | date | no | Fin del plazo de protección |
| `vpp_max_legal_price_cents` | bigint | no | Precio máximo legal si se conoce; tope del valor (RN-06) |
| `useful_m2`, `built_m2` | numeric(7,2) | sí | Superficies útil y construida |
| `bedrooms`, `bathrooms` | smallint | sí | Dormitorios y baños |
| `floor` | text | no | Planta (admite «bajo», «ático»…) |
| `has_lift`, `garage`, `storage_room` | boolean | sí | Ascensor, garaje, trastero |
| `features` | jsonb | no | Características adicionales (terraza, piscina comunitaria, estado…). Ver R-2 |
| `energy_rating` | text | no | Letra del certificado energético. ⚠️ SUPUESTO: A–G |
| `year_built` | smallint | no | Año de construcción |
| `value_min_cents`, `value_max_cents` | bigint | sí | Rango de valor declarado por el propietario (RF-12) |
| `is_primary_residence` | boolean | sí | Vivienda habitual (simulador fiscal, RF-16) |
| `mortgage_outstanding_cents` | bigint | no | Hipoteca pendiente aproximada (RF-15). ⚠️ El README menciona también la entidad y «otras cargas», sin columna: ver R-3 |
| `exact_address` | bytea | sí | Dirección exacta **cifrada**; solo se revela a participantes de un match (RN-08) |
| `approx_location` | geography(Point, 4326) | sí | Ubicación pública aproximada (RF-13). ⚠️ PENDIENTE: método de aproximación (centroide de barrio o desplazamiento aleatorio) |

### `home_photos` — fotos de una vivienda (3–20, RF-11)

`home_id` FK, `storage_path` (ruta en el bucket público, sin EXIF de ubicación),
`position` (orden de presentación).

### `search_preferences` — qué busca un usuario

| Atributo | Tipo | Significado |
|---|---|---|
| `user_id` | uuid FK, único | Una preferencia por usuario. ⚠️ Con varias viviendas por usuario (RF-20, fase 3) quizá deba ser por vivienda |
| `areas` | geography | Zona de interés (punto o polígono) |
| `municipalities` | text[] | Municipios de interés. Ver R-2 |
| `radius_km` | numeric | Radio alrededor del punto |
| `filters` | jsonb | Tipo, superficie mínima, dormitorios… (RF-31) |
| `max_to_pay_cents` | bigint | Máximo que paga como compensación (RF-32) |
| `min_to_receive_cents` | bigint | Mínimo que acepta recibir (RF-32) |
| `move_date` | date | Fecha deseada orientativa (fase 2) |

### `likes` — arista del grafo de interés

`from_home_id` → `to_home_id`: el propietario de la vivienda origen quiere la
vivienda destino. Clave primaria compuesta; `created_at`.

### `dismissals` — descartes (RF-44)

`home_id` descarta `dismissed_home_id`. ⚠️ Para «volver a mostrar si cambia de
forma relevante» falta registrar qué versión se descartó: ver R-5.

### `matches` — ciclo de interés recíproco y compatible

`type` 2 o 3; `status` `open`, `confirmed`, `in_operation`, `closed`,
`expired`; `cycle_key` único = identificadores de vivienda ordenados y
concatenados (evita duplicados, README §11).

### `match_participants` — cada vivienda de un match

`gives_home_id` (la que entrega, igual a `home_id`), `receives_home_id`,
`compensation_cents` (positivo = paga, negativo = recibe; la suma en un match
es 0, RN-04), `status` `pending`, `confirmed`, `withdrawn`.

### `operations` — permuta en tramitación (fase 2)

`match_id` único, `agency_id`, `status` `proposed`, `documentation`,
`appraisal`, `financing`, `signing_scheduled`, `signed`, `cancelled` (RF-81),
`signed_at`, `fee_amount_cents`.

### `agencies` — gestorías asociadas

`name`, `cif` único, `zones` (ver R-2), `contact`, `active`.

### `documents` — documentación privada de una operación

`operation_id`, `uploaded_by`, `type`, `storage_path` en el bucket **privado**;
acceso por URL firmada de corta duración (RNF-03).

### `reports` — denuncias (RF-63)

`reporter_id`, `target_type` (`user`, `home`, `message`), `target_id`
(polimórfico, ver R-6), `reason`, `status`.

### `consents` — registro de consentimientos (RF-04, RNF-13)

`user_id`, `type` (términos, privacidad, analítica, derivación a terceros…),
`version`, `accepted_at`. Solo inserción: un cambio de versión es una fila
nueva.

### `audit_log` — acciones administrativas y sensibles (RF-93)

`actor_id`, `action`, `entity`, `entity_id`, `at`. Solo inserción.
⚠️ PENDIENTE: retención (`$LOG_RETENTION`).

### `waitlist` — lista de espera de la landing (RF-101)

`email` único, `municipality`, `home_type`, `looking_for`, `consent_at`.

## 3 · Reglas de integridad

**Claves primarias**: `uuid` v7 generado en la aplicación (⚠️ SUPUESTO: no
expone volumen, es ordenable y permite crear entidades en el dominio antes de
persistir). `audit_log` usa `bigint` identidad.

**Claves foráneas y borrado:**

| FK | Ante borrado del padre | Motivo |
|---|---|---|
| `homes.owner_id` → `users` | `RESTRICT` | El usuario se borra lógicamente; sus viviendas pasan a `closed` en el caso de uso |
| `home_photos.home_id` → `homes` | `CASCADE` | Sin vivienda no hay fotos (el fichero se borra aparte) |
| `search_preferences.user_id` → `users` | `CASCADE` | — |
| `likes.*`, `dismissals.*` → `homes` | `CASCADE` | Aristas sin sentido sin sus nodos |
| `match_participants.match_id` → `matches` | `CASCADE` | — |
| `match_participants.home_id`/`user_id` → `homes`/`users` | `RESTRICT` | El histórico de matches se conserva |
| `operations.match_id` → `matches` | `RESTRICT` | — |
| `operations.agency_id` → `agencies` | `RESTRICT` | Las gestorías se desactivan, no se borran |
| `documents.operation_id` → `operations` | `RESTRICT` | Documentación legal: no se borra en cascada |
| `consents.user_id`, `audit_log.actor_id`, `reports.reporter_id` → `users` | `RESTRICT` | Evidencia legal |

**Restricciones que expresan reglas de negocio** (en el esquema, no solo en el
código):

| Restricción | Regla |
|---|---|
| `CHECK (value_min_cents > 0 AND value_min_cents <= value_max_cents)` | RF-12 |
| `CHECK (regime = 'libre' OR vpp_max_legal_price_cents IS NULL OR value_max_cents <= vpp_max_legal_price_cents)` | RN-06 |
| `CHECK (regime = 'libre' OR vpp_qualification_date IS NOT NULL)` | RF-14 ⚠️ SUPUESTO: obligatoria en VPP |
| `CHECK (from_home_id <> to_home_id)` en `likes` y `dismissals` | Sin auto-likes |
| `UNIQUE (cycle_key)` en `matches` | Sin matches duplicados del mismo ciclo |
| `CHECK (type IN (2,3))` en `matches` | RN-05 |
| `UNIQUE (match_id)` en `operations` | Una operación por match |
| `UNIQUE (firebase_uid)`, `UNIQUE (email)` en `users` | — |
| `CHECK (position BETWEEN 1 AND 20)` en `home_photos` | RF-11 (el mínimo de 3 se valida en el caso de uso de publicación) |

La suma cero de compensaciones (RN-04) y la compatibilidad económica (RN-03)
afectan a varias filas: se garantizan en el **dominio**, dentro de la misma
transacción que crea el match, y se cubren con pruebas de propiedades.

**Estrategia de borrado**: lógico en `users` (`deleted_at` + anonimización de
`email`, `display_name`, `phone`), físico en datos derivados sin valor legal
(fotos, likes, descartes, preferencias). Lo que es evidencia legal
(`consents`, `audit_log`, `documents`, `operations`) no se borra.

## 4 · Consultas frecuentes y rendimiento

| Acceso | Consulta | Índice que la sostiene |
|---|---|---|
| Detección de ciclo de 2 | `likes WHERE from_home_id = :y AND to_home_id = :x` | PK `(from_home_id, to_home_id)` |
| Detección de ciclo de 3 | join `likes l1` (from = :y) con `likes l2` (from = l1.to, to = :x) | PK + índice `likes(to_home_id, from_home_id)` |
| Tarjetas de descubrimiento | viviendas `published` dentro de la zona, filtros, no descartadas, no propias, compatibilidad económica en ambos sentidos | GIST en `homes(approx_location)`; parcial `homes(status) WHERE status = 'published'`; PK de `dismissals` |
| Matches de un usuario | `match_participants WHERE user_id = :u` | índice `match_participants(user_id)` |
| Matches abiertos de una vivienda (para pausar al entrar en operación) | `match_participants WHERE home_id = :h` | PK `(match_id, home_id)` + índice `(home_id)` |
| Límite diario de likes | likes de las viviendas de un usuario desde las 00:00 | índice `likes(from_home_id, created_at)` |
| Moderación | `homes WHERE status = 'in_review' ORDER BY created_at` | parcial `homes(created_at) WHERE status = 'in_review'` |

Volumetría declarada: **50.000 viviendas** con detección de ciclos < 1 s
(RNF-20) y 1.000 viviendas en los primeros 6 meses. ⚠️ PENDIENTE: likes por
usuario y día, que determinan el tamaño de `likes`. Sin ese dato no se
proponen particionado, desnormalización ni caché.

## 5 · Datos sensibles

`$NORMATIVA`: RGPD/LOPDGDD. `$DATOS_CATEGORIA_ESPECIAL`: ninguno del art. 9 en
el MVP (⚠️ SUPUESTO).

| Atributo | Clase | Protección |
|---|---|---|
| `homes.exact_address` | Personal sensible (localiza el domicilio) | Cifrado en aplicación (clave en Secret Manager); solo se descifra para participantes de un match |
| `users.phone` | Personal | Acceso restringido; solo se revela con autorización del usuario |
| `users.email`, `display_name`, `firebase_uid` | Personal | Anonimización al borrar la cuenta |
| `users.is_over_65` | Personal (deriva la edad) | No se muestra a terceros; solo para el simulador |
| `users.meets_vpp_requirements` | Personal (indica nivel de renta) | No se muestra a terceros |
| `homes.mortgage_outstanding_cents` | Económico personal | No se muestra a terceros; solo para el simulador y la gestoría |
| `homes.approx_location` | Personal aproximado | La aproximación debe impedir reidentificar el portal |
| `home_photos` | Puede contener datos personales | Eliminación de EXIF de ubicación al subir (RF-11) |
| `documents` | Notas simples, tasaciones | Bucket privado, URL firmada de corta duración; las notas simples no se vuelcan a la base de datos (README §13) |
| `waitlist.email` | Personal | Consentimiento registrado; ⚠️ PENDIENTE: plazo de conservación |
| `audit_log`, `consents` | Evidencia | Solo inserción; ⚠️ PENDIENTE: `$LOG_RETENTION` |
| KYC (fase 2) | Posible categoría especial (biometría) | Fuera del modelo hasta elegir proveedor; preferible no almacenar biometría propia |

## 6 · Evolución del esquema

- Cambios con **drizzle-kit**: el esquema TypeScript genera migraciones SQL en
  `db/migrations`, que se revisan y se versionan. Nunca `push` directo contra
  DES ni PROD.
- Las migraciones se aplican en el despliegue, **antes** de la nueva versión de
  la API, y deben ser compatibles con la versión anterior (expandir → migrar →
  contraer).
- **Incompatibles** (requieren coordinación con el despliegue en dos pasos):
  renombrar o borrar columnas o tablas, cambiar tipos, añadir `NOT NULL` sin
  valor por defecto, cambiar valores de un enum en uso.
- Las extensiones (`postgis`, `citext`) se crean en la primera migración.

## Riesgos detectados

| # | Riesgo | Propuesta |
|---|---|---|
| R-1 | El README no fija el tipo de los importes (`value_min`, `compensation`, `fee_amount`…). `float` produciría errores de redondeo | `bigint` en céntimos (o `numeric(12,2)`). ⚠️ Confirmar |
| R-2 | Campos multivalor en una columna: `features`, `filters`, `zones`, `areas`/`municipalities` | Aceptable para filtros flexibles; pero `agencies.zones` se usa para asignar gestoría por zona y debería ser una tabla `agency_zones` o geografía |
| R-3 | Cargas «entidad» y «otras cargas» (RF-15) sin columna | Añadir `mortgage_entity` y `other_charges`, o confirmar que no se guardan |
| R-4 | `users.role` único, pero un usuario es `propietario` o `buscador` según tenga vivienda publicada: es un estado derivado, no un rol asignado | Guardar solo roles asignados (`user`, `gestoria`, `admin`) y derivar propietario/buscador. ⚠️ Decidir en la matriz RBAC |
| R-5 | `dismissals` no guarda la versión descartada; RF-44 exige volver a mostrar si cambian precio o fotos | Añadir `homes.relevant_version` (o `relevant_updated_at`) y guardarlo en el descarte |
| R-6 | `reports.target_id` polimórfico sin FK | Aceptable para denuncias; validar existencia en el caso de uso |
| R-7 | `match_participants.user_id` duplica `homes.owner_id` | Útil como instantánea si la vivienda cambia de dueño; documentarlo como intencionado |
| R-8 | `gestoria` necesita vincular usuario y `agencies`; no hay relación | Añadir `users.agency_id` o tabla `agency_members` (fase 2) |
| R-9 | Los mensajes de chat denunciados viven en Firestore | La moderación necesita copiar el mensaje denunciado a `reports` como evidencia |

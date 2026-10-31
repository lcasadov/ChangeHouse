# ChangeHouse

> **Cambia de casa sin vender primero.** Plataforma móvil y web para la **permuta de viviendas**
> entre particulares: publicas tu vivienda, marcas las que te gustan y, cuando hay interés
> recíproco —entre dos viviendas o en cadena de tres—, la plataforma pone en contacto a los
> propietarios y les acompaña hasta la notaría a través de gestorías asociadas.

Este documento es el **punto de partida del desarrollo**: recoge la visión del producto, los
requisitos funcionales y no funcionales, el stack técnico y las decisiones pendientes. Es la
entrada para generar `docs/project.md` (comando `/harness:01-bootstrap-project` de Claude Code)
y los primeros *changes* de OpenSpec.

---

## Índice

1. [Visión y propuesta de valor](#1--visión-y-propuesta-de-valor)
2. [Modelo de negocio](#2--modelo-de-negocio)
3. [Alcance y fases](#3--alcance-y-fases)
4. [Actores y roles](#4--actores-y-roles)
5. [Requisitos funcionales](#5--requisitos-funcionales)
6. [Reglas de negocio](#6--reglas-de-negocio)
7. [Requisitos no funcionales](#7--requisitos-no-funcionales)
8. [Requisitos técnicos y stack](#8--requisitos-técnicos-y-stack)
9. [Arquitectura](#9--arquitectura)
10. [Modelo de datos inicial](#10--modelo-de-datos-inicial)
11. [Algoritmo de emparejamiento](#11--algoritmo-de-emparejamiento)
12. [Infraestructura y despliegue](#12--infraestructura-y-despliegue)
13. [Cumplimiento legal](#13--cumplimiento-legal)
14. [Métricas de éxito](#14--métricas-de-éxito)
15. [Riesgos](#15--riesgos)
16. [Decisiones pendientes](#16--decisiones-pendientes)
17. [Glosario](#17--glosario)

---

## 1 · Visión y propuesta de valor

### Problema

Cambiar de vivienda en propiedad obliga a **vender y comprar por separado**: dos operaciones,
dos comisiones de agencia, riesgo de vender sin haber encontrado casa (o de comprar sin haber
vendido) y necesidad de financiar la compra completa.

### Solución

Un sistema de descubrimiento tipo *swipe* donde **cada usuario es a la vez vendedor y comprador**.
Cuando el propietario de A quiere la vivienda de B y el de B quiere la de A, hay *match*.
Además, la plataforma detecta **cadenas de tres** (A quiere B, B quiere C, C quiere A).

### Propuesta de valor (lo que comunicamos)

| Beneficio | Detalle |
|---|---|
| **Sin agencia** | Ahorro de la comisión de venta (habitualmente 3–5 % + IVA por parte) |
| **Sin riesgo de quedarse sin casa** | Las transmisiones se firman el mismo día |
| **Menos hipoteca** | Solo se financia la **diferencia de valor** entre viviendas |
| **Impuestos correctos, con exenciones aplicadas** | Simulador que muestra ITP, IRPF y plusvalía municipal, incluyendo exención por reinversión en vivienda habitual y mayores de 65 |
| **Acompañamiento** | Gestoría asociada que tramita hasta la notaría |

> ⚠️ **ChangeHouse nunca se comunica como "ahorro fiscal por escriturar menos".** Los valores de
> escritura deben ser valores de mercado defendibles (ver [§6](#6--reglas-de-negocio) y
> [§13](#13--cumplimiento-legal)).

### Mercado inicial

**Madrid capital y área metropolitana** (incluido el caso ciudad ↔ municipio cercano).
Segmentos prioritarios:

- Familias que necesitan más espacio ↔ personas que quieren reducir (*downsizing*).
- Ciudad ↔ municipio cercano / costa.
- Traslados laborales entre ciudades.
- Propietarios de **VPPL/VPO** próximas a fin del régimen de protección o descalificables.

### Competencia de referencia

| Plataforma | País | Relación |
|---|---|---|
| Muévete (muevete.house) | España | Competidor directo en propiedad; sin cadenas ni app conocida |
| Idealista / Fotocasa | España | Anuncios que "aceptan permuta", sin emparejamiento |
| Tauschwohnung, Wohnungsswap | Alemania | Permuta de alquileres; Wohnungsswap con tríos |
| HomeSwapper, House Exchange | Reino Unido | Vivienda social, cadenas de 3+, modelo B2G |

---

## 2 · Modelo de negocio

| Fuente de ingreso | Descripción | Fase |
|---|---|---|
| **Comisión de éxito** | Importe fijo o porcentaje por parte, **solo al firmar** la operación. Nunca por *match* | MVP+ |
| **Gestorías asociadas** | Pago por operación derivada o reparto de la minuta | MVP+ |
| **Derivación de servicios** | Broker hipotecario (financiar la diferencia), tasadoras homologadas, mudanzas | Fase 2 |
| **Destacados** | Suscripción opcional para mayor visibilidad del anuncio | Fase 3 |
| **B2G (futuro)** | Licencia a empresas públicas de vivienda para permutas entre inquilinos | Fase 4 |

---

## 3 · Alcance y fases

| Fase | Objetivo | Contenido |
|---|---|---|
| **0 · Validación** | Medir demanda sin app | Landing + lista de espera + historia del fundador + contacto con 3–5 gestorías. Criterio de avance: ~100 viviendas apuntadas en Madrid y ≥1 gestoría interesada |
| **1 · MVP** | Primeros matches reales | Registro, ficha de vivienda (incl. VPP), preferencias, *swipe*, matches de 2 y 3, chat, notificaciones, panel de administración básico |
| **2 · Operación** | Cerrar permutas | Simulador fiscal, red de gestorías, flujo de operación hasta firma, pago de comisión, verificación de identidad, tasaciones |
| **3 · Datos** | Precios defendibles | Rango de precios de cierre por zona, valor de referencia, alertas de fin de protección VPP, destacados |
| **4 · Ampliación** | Nuevos mercados | Alquiler (subrogación con consentimiento del arrendador), otras ciudades, B2G |

### Fuera de alcance del MVP

- Pagos dentro de la app y custodia de fondos (*escrow*).
- Tasación automática (AVM) propia.
- Alquiler y vivienda pública B2G.
- Cadenas de más de 3 viviendas.
- Cualquier recomendación del **valor de escritura**.

---

## 4 · Actores y roles

| Rol | Descripción | Fase |
|---|---|---|
| `visitante` | Navega la landing y ve viviendas de ejemplo sin datos sensibles | 0 |
| `propietario` | Usuario registrado con al menos una vivienda publicada; da likes, recibe matches, chatea | 1 |
| `buscador` | Usuario registrado sin vivienda publicada (solo puede mirar; **no genera matches**) | 1 |
| `gestoria` | Profesional asociado; recibe operaciones derivadas y actualiza su estado | 2 |
| `admin` | Equipo ChangeHouse: moderación, verificación, soporte, métricas | 1 |

Modelo de acceso: **deny-by-default** y autorización centralizada en la API. La matriz de permisos
detallada se definirá en `$RBAC_MATRIX_DOC`.

---

## 5 · Requisitos funcionales

Prioridad: **M** (MVP, imprescindible) · **S** (fase 2) · **C** (fase 3+).

### 5.1 Cuentas y perfil

| ID | Requisito | Prio |
|---|---|---|
| RF-01 | Registro e inicio de sesión con email/contraseña, Google y Apple | M |
| RF-02 | Verificación de email; recuperación de contraseña | M |
| RF-03 | Perfil: nombre visible, foto opcional, municipio, teléfono (privado, no se muestra hasta el match) | M |
| RF-04 | Aceptación de términos y política de privacidad con registro de versión y fecha | M |
| RF-05 | Eliminación de cuenta y exportación de datos (derechos RGPD) | M |
| RF-06 | Verificación de identidad (KYC) antes de iniciar una operación | S |

### 5.2 Viviendas

| ID | Requisito | Prio |
|---|---|---|
| RF-10 | Alta de vivienda: tipo (piso, ático, dúplex, chalet, adosado…), dirección (autocompletado), superficie útil y construida, dormitorios, baños, planta, ascensor, garaje, trastero, terraza, piscina comunitaria, estado, año de construcción, certificado energético | M |
| RF-11 | Fotos (mín. 3, máx. 20), con compresión y eliminación de metadatos EXIF de ubicación | M |
| RF-12 | **Valor declarado por el propietario** como rango (mín.–máx.) | M |
| RF-13 | El propietario elige mostrar la **ubicación exacta** o solo el **barrio o zona**; la dirección postal exacta solo se revela tras el match | M |
| RF-14 | Régimen de la vivienda: libre / **VPP** (VPPB, VPPL, VPO); para VPP: fecha de calificación definitiva, plazo de protección, precio máximo legal si se conoce | M |
| RF-15 | Cargas declaradas: hipoteca pendiente (importe aproximado, entidad), otras cargas | M |
| RF-16 | ¿Es vivienda habitual del propietario? (necesario para el simulador fiscal) | M |
| RF-17 | Estado del anuncio: borrador, en revisión, publicado, pausado, en operación, cerrado | M |
| RF-18 | Moderación previa a la publicación (manual en MVP) | M |
| RF-19 | Verificación de titularidad mediante nota simple aportada por el usuario (ver restricciones en [§13](#13--cumplimiento-legal)) | S |
| RF-20 | Un usuario puede tener varias viviendas; cada una participa en el matching de forma independiente | M |

### 5.3 Preferencias de búsqueda

| ID | Requisito | Prio |
|---|---|---|
| RF-30 | Zonas de interés: municipios y/o radio en km alrededor de un punto | M |
| RF-31 | Filtros: tipo, superficie mínima, dormitorios, baños, garaje, ascensor, exterior, etc. | M |
| RF-32 | **Compensación económica**: máximo que el usuario está dispuesto a **pagar** y mínimo que acepta **recibir** como diferencia de valor | M |
| RF-33 | Indicador de si el usuario **cumple requisitos de acceso a VPP** (para mostrarle o no viviendas protegidas) | M |
| RF-34 | Fecha deseada de mudanza (orientativa) | S |

### 5.4 Descubrimiento (*swipe*)

| ID | Requisito | Prio |
|---|---|---|
| RF-40 | Tarjetas de viviendas que cumplen las preferencias del usuario y cuyo propietario podría estar interesado (compatibilidad económica en ambos sentidos) | M |
| RF-41 | Acciones: **Me gusta**, **Descartar**, **Ver detalle**; deshacer la última acción | M |
| RF-42 | Vista alternativa en lista y en mapa | S |
| RF-43 | Guardado de favoritos | S |
| RF-44 | Los descartes no vuelven a mostrarse salvo que la vivienda cambie de forma relevante (precio, fotos) | M |
| RF-45 | Límite diario de likes configurable (anti-spam); 10 por usuario y día de inicio | M |

### 5.5 Matching

| ID | Requisito | Prio |
|---|---|---|
| RF-50 | **Match directo** (ciclo de 2): A↔B se gustan mutuamente y son compatibles económicamente | M |
| RF-51 | **Match en cadena** (ciclo de 3): A→B→C→A, compatibles económicamente | M |
| RF-52 | Al crear un match se notifica a todos los participantes y se abre un **chat de grupo** | M |
| RF-53 | Tras el match se revela: dirección exacta, fotos completas y nombre; el teléfono solo si el usuario lo autoriza | M |
| RF-54 | Cada participante puede **confirmar interés** o **retirarse**; si alguien se retira, el match se cierra para todos | M |
| RF-55 | Una vivienda puede estar en varios matches abiertos; al entrar en **operación** se pausan los demás | M |
| RF-56 | El match muestra la **compensación económica estimada** de cada participante (quién paga y cuánto) | M |
| RF-57 | Caducidad de matches sin actividad (p. ej., 30 días) con aviso previo | S |

### 5.6 Comunicación

| ID | Requisito | Prio |
|---|---|---|
| RF-60 | Chat en tiempo real por match (2 o 3 participantes), con texto e imágenes | M |
| RF-61 | Notificaciones push: nuevo match, nuevo mensaje, cambio de estado de operación | M |
| RF-62 | Notificaciones por email para eventos clave | M |
| RF-63 | Denunciar y bloquear usuarios; moderación de mensajes denunciados | M |
| RF-64 | Plantillas de "próximos pasos" (visitar la vivienda, pedir tasación, contactar con gestoría) | S |

### 5.7 Simulador fiscal y económico

| ID | Requisito | Prio |
|---|---|---|
| RF-70 | Estimación por participante de: ITP (tipo de la comunidad autónoma), IRPF por ganancia patrimonial, plusvalía municipal (orientativa), notaría y registro | S |
| RF-71 | Aplicación de exenciones: reinversión en vivienda habitual (total o proporcional), mayores de 65 | S |
| RF-72 | Comparativa **permuta vs. vender y comprar por separado**, incluyendo comisiones de agencia | S |
| RF-73 | Para VPP: aviso de precio máximo legal, autorización/visado, tanteo y retracto y requisitos del adquirente | S |
| RF-74 | Aviso legal visible: estimación orientativa, no constituye asesoramiento; valida tu gestoría | S |
| RF-75 | Mostrar **valor de referencia** (si el usuario lo aporta) como suelo del ITP | C |
| RF-76 | Mostrar **rango de precios de cierre** de la zona como referencia de valor de mercado | C |

### 5.8 Operación y gestorías

| ID | Requisito | Prio |
|---|---|---|
| RF-80 | Cuando todos confirman, el match pasa a **operación** y se ofrece una gestoría asociada de la zona | S |
| RF-81 | Estados de operación: propuesta, documentación, tasación, financiación, firma programada, firmada, cancelada | S |
| RF-82 | Portal de gestoría (web): operaciones asignadas, documentación, cambio de estado, notas | S |
| RF-83 | Gestión documental privada por operación (notas simples, tasaciones, borradores) con acceso solo a participantes y gestoría | S |
| RF-84 | Cobro de la comisión de éxito a la firma (Stripe) y facturación | S |
| RF-85 | Derivación opcional a broker hipotecario y tasadora, con consentimiento explícito del usuario | S |

### 5.9 Administración

| ID | Requisito | Prio |
|---|---|---|
| RF-90 | Panel web de administración: usuarios, viviendas, moderación, denuncias | M |
| RF-91 | Métricas: altas, viviendas publicadas por zona, likes, matches (2 y 3), operaciones | M |
| RF-92 | Alta y gestión de gestorías asociadas y sus zonas | S |
| RF-93 | Registro de auditoría de acciones administrativas | M |

### 5.10 Landing y captación

| ID | Requisito | Prio |
|---|---|---|
| RF-100 | Landing pública con propuesta de valor, cómo funciona, historia del fundador y FAQ | M |
| RF-101 | Formulario de lista de espera (email, municipio, tipo de vivienda, qué busca) con consentimiento RGPD | M |
| RF-102 | Blog/guías (permuta, VPP, fiscalidad) orientado a SEO | S |
| RF-103 | Páginas legales: aviso legal, privacidad, cookies, términos | M |

---

## 6 · Reglas de negocio

| ID | Regla |
|---|---|
| RN-01 | Solo generan matches los usuarios con **al menos una vivienda publicada**. |
| RN-02 | Existe arista A→B cuando el propietario de A da *like* a B **y** B cumple las preferencias de A. |
| RN-03 | **Compatibilidad económica**: en cada ciclo, la compensación neta de cada participante = (valor de la vivienda que recibe − valor de la que entrega). Debe ser ≤ su máximo a pagar si es positiva, y su valor absoluto ≥ su mínimo a recibir si es negativa. Se usa el punto medio del rango declarado (configurable). |
| RN-04 | En todo ciclo la suma de compensaciones es 0: el dinero solo circula entre participantes. |
| RN-05 | Longitud máxima de ciclo: **3**. |
| RN-06 | Una vivienda **VPP** solo se muestra a usuarios que declaran cumplir los requisitos de acceso; su valor no puede superar el **precio máximo legal** declarado. |
| RN-07 | La plataforma **nunca propone ni recomienda valores de escritura**. Muestra rangos orientativos y remite a tasación y gestoría. |
| RN-08 | La dirección exacta y los datos de contacto solo se revelan a participantes de un match. |
| RN-09 | La comisión de éxito solo se devenga con la **firma** de la operación. |
| RN-10 | Si un participante se retira de un match, el match se cierra para todos y se notifica. |
| RN-11 | Una vivienda en estado **en operación** no aparece en el descubrimiento. |

---

## 7 · Requisitos no funcionales

### Seguridad

| ID | Requisito |
|---|---|
| RNF-01 | Autorización **deny-by-default** centralizada en la API; nunca se confía en el cliente para permisos ni transiciones de estado. |
| RNF-02 | Tokens de Firebase Auth verificados en cada petición a la API. |
| RNF-03 | Documentos privados (notas simples, tasaciones) en bucket privado, acceso mediante URL firmada de corta duración. |
| RNF-04 | Secretos en **Google Secret Manager**; nunca en el repositorio. |
| RNF-05 | Cumplimiento OWASP ASVS nivel 2 en API y web; OWASP MASVS en móvil. |
| RNF-06 | Limitación de peticiones (*rate limiting*) y protección anti-abuso en likes, chat y registro. |
| RNF-07 | Cifrado en tránsito (TLS 1.2+) y en reposo (por defecto en GCP). |

### Privacidad (RGPD)

| ID | Requisito |
|---|---|
| RNF-10 | Datos alojados en la UE, región **`europe-southwest1` (Madrid)** siempre que el servicio lo permita. |
| RNF-11 | Minimización: no se almacenan NIF ni datos registrales más allá de lo necesario para verificar. |
| RNF-12 | Ubicación pública aproximada; dirección exacta cifrada o con acceso restringido. |
| RNF-13 | Registro de consentimientos; derechos de acceso, rectificación, supresión y portabilidad. |
| RNF-14 | Registro de actividades de tratamiento y evaluación de impacto (EIPD) antes del lanzamiento. |

### Rendimiento y disponibilidad

| ID | Requisito |
|---|---|
| RNF-20 | API: p95 < 300 ms en lecturas; detección de ciclos tras un like < 1 s con 50.000 viviendas. |
| RNF-21 | App: arranque en frío < 3 s en gama media; carga de tarjeta < 1 s con imágenes optimizadas (CDN). |
| RNF-22 | Disponibilidad objetivo MVP: 99,5 % mensual. |
| RNF-23 | Escalado a cero en servicios sin tráfico para minimizar coste. |

### Calidad

| ID | Requisito |
|---|---|
| RNF-30 | **TDD** obligatorio (Red → Green → Refactor). |
| RNF-31 | Cobertura **≥ 80 %**, comprobada en GitHub Actions con el umbral de cobertura de Vitest (al ser un proyecto nuevo, todo el código es código nuevo). Los checks de Actions son obligatorios para integrar (protección de rama) y **CodeRabbit** revisa cada pull request. |
| RNF-32 | TypeScript en modo `strict` en todo el monorepo; ESLint + Prettier. |
| RNF-33 | El algoritmo de matching y el simulador fiscal tienen pruebas basadas en propiedades. |

### Usabilidad, accesibilidad e internacionalización

| ID | Requisito |
|---|---|
| RNF-40 | Accesibilidad **WCAG 2.2 AA**. |
| RNF-41 | Temas **claro** (predeterminado) y **oscuro**, siguiendo la preferencia del sistema; solo tokens de diseño, sin valores literales. |
| RNF-42 | Idioma **español (es-ES)** en el MVP; todos los textos externalizados para añadir inglés y otros idiomas. |
| RNF-43 | Plataformas: Android 10+, iOS 16+, web en las dos últimas versiones de Chrome, Safari, Firefox y Edge. |

### Observabilidad

| ID | Requisito |
|---|---|
| RNF-50 | Logs estructurados (JSON) en Cloud Logging, sin datos personales. |
| RNF-51 | Errores de app y API en Sentry; alertas por correo. |
| RNF-52 | Analítica de producto (embudo registro → vivienda → like → match → operación) con consentimiento. |
| RNF-53 | Alerta de presupuesto en Google Cloud desde el primer día. |

---

## 8 · Requisitos técnicos y stack

Todo el proyecto en **TypeScript**, organizado como **monorepo**.

| Capa | Tecnología |
|---|---|
| Lenguaje | TypeScript 5 (modo `strict`) |
| Runtime de servidor | Node.js 24 LTS |
| Gestor de paquetes / monorepo | pnpm workspaces + Turborepo |
| **App móvil y web** | **Expo (React Native) + Expo Router**, última SDK estable; Android, iOS y web desde un único código |
| Estado y datos en la app | TanStack Query (estado de servidor) + Zustand (estado local) |
| Formularios y validación | React Hook Form + **Zod** (esquemas compartidos con la API) |
| Mapas | react-native-maps + Google Places (autocompletado) |
| Notificaciones | Firebase Cloud Messaging vía `@react-native-firebase/messaging` |
| Compilación y publicación móvil | **EAS Build / EAS Submit** (Expo) |
| **Landing y blog** | **Astro** (sitio estático, SEO), desplegado en Firebase Hosting |
| **API** | **Fastify** + TypeScript, desplegada en **Cloud Run** |
| Acceso a datos | **Drizzle ORM** + drizzle-kit (migraciones) |
| **Base de datos** | **PostgreSQL 17 + PostGIS** en **Cloud SQL** |
| Chat en tiempo real | Cloud Firestore |
| Autenticación | Firebase Authentication (email, Google, Apple) |
| Ficheros | Cloud Storage (bucket público de fotos vía CDN; bucket privado de documentos) |
| Pagos | Stripe (Checkout / Payment Links para la comisión de éxito) |
| Email transaccional | Extensión Trigger Email de Firebase con SMTP de Gmail (provisional hasta tener dominio propio) |
| Errores | Sentry (app y API) |
| Analítica | Firebase Analytics (con consentimiento) |
| Pruebas | Vitest (unitarias e integración), fast-check (propiedades), Testcontainers (PostgreSQL real), React Native Testing Library, Playwright (web/landing), Maestro (E2E móvil) |
| Calidad | ESLint, Prettier, CodeRabbit (revisión automática de PR) |
| Repositorio, CI y tareas | **GitHub** (repositorio), **GitHub Actions** (CI/CD), **GitHub Issues + Projects** (tareas) |

> **Nota sobre Expo:** Firebase nativo, mapas y Stripe requieren *development builds*
> (no funcionan en Expo Go). Es el flujo previsto.

> **Nota sobre pagos en tiendas:** la comisión retribuye un servicio prestado fuera de la app
> (intermediación de una operación inmobiliaria), por lo que se cobra con Stripe y no con el
> sistema de compras integradas de Apple/Google. Revisar las directrices vigentes antes de publicar.

### Comandos previstos

| Acción | Comando |
|---|---|
| Instalar dependencias | `pnpm install` |
| Arrancar todo en local | `pnpm dev` |
| Lint y formato | `pnpm lint` |
| Comprobación de tipos | `pnpm typecheck` |
| Pruebas | `pnpm test` |
| Cobertura | `pnpm test:coverage` |
| Migraciones | `pnpm db:migrate` |
| Build | `pnpm build` |

Guía para arrancar todo en local y probar la app en un móvil de la misma Wi-Fi:
[`docs/desarrollo-local.md`](docs/desarrollo-local.md).

---

## 9 · Arquitectura

### Vista general

```text
  [App Expo: Android / iOS / Web]          [Landing Astro]
            │                                     │
            ├── Firebase Auth (login)             └── Firebase Hosting
            ├── Firestore (chat)
            ├── Cloud Storage (fotos / documentos)
            ├── FCM (push)
            └── HTTPS ──► API Fastify (Cloud Run, Madrid)
                               │
                               ├── Cloud SQL PostgreSQL + PostGIS
                               ├── Motor de matching (ciclos de 2 y 3)
                               ├── Simulador fiscal
                               ├── Stripe (webhooks)
                               └── Secret Manager
```

### Estilo

- **API:** arquitectura **hexagonal**. El dominio (matching, compensaciones, simulador fiscal,
  estados de match y operación) es código puro sin dependencias de infraestructura, lo que
  permite probarlo exhaustivamente. Adaptadores para PostgreSQL, Firebase, Stripe y email.
- **App:** organización **por funcionalidad** (`features/auth`, `features/homes`,
  `features/discover`, `features/matches`, `features/chat`…).

### Estructura del repositorio

```text
ChangeHouse/
├── apps/
│   ├── mobile/            # Expo: Android, iOS y web (incluye portal de gestoría y admin en fase 1-2)
│   └── landing/           # Astro: web pública, blog y lista de espera
├── services/
│   └── api/
│       ├── src/domain/            # Entidades, reglas, matching, simulador fiscal
│       ├── src/application/       # Casos de uso
│       ├── src/infrastructure/    # Drizzle, Firebase, Stripe, email
│       └── src/interfaces/http/   # Rutas Fastify y validación Zod
├── packages/
│   ├── shared/            # Esquemas Zod, tipos y constantes comunes
│   └── ui/                # Tokens de diseño y componentes compartidos
├── db/
│   └── migrations/        # Migraciones SQL (Drizzle)
├── infra/                 # Definición de servicios GCP y scripts de despliegue
├── docs/                  # project.md, arquitectura, contrato de API, RBAC, estrategia de pruebas
└── openspec/              # Specs y changes
```

---

## 10 · Modelo de datos inicial

Orientativo; se concretará en `docs/` y en los specs de OpenSpec.

| Entidad | Campos principales |
|---|---|
| `users` | id, firebase_uid, email, display_name, phone (privado), municipality, meets_vpp_requirements, is_over_65, kyc_status, role, created_at, deleted_at |
| `homes` | id, owner_id, type, status, regime (libre/VPPB/VPPL/VPO), vpp_qualification_date, vpp_protection_end, vpp_max_legal_price, useful_m2, built_m2, bedrooms, bathrooms, floor, has_lift, garage, storage_room, features (jsonb), energy_rating, year_built, value_min, value_max, is_primary_residence, mortgage_outstanding, exact_address (restringido), approx_location (geography), created_at |
| `home_photos` | id, home_id, storage_path, position |
| `search_preferences` | id, user_id, areas (geography / municipios), radius_km, filters (jsonb), max_to_pay, min_to_receive, move_date |
| `likes` | from_home_id, to_home_id, created_at — **aristas del grafo** |
| `dismissals` | home_id, dismissed_home_id, created_at |
| `matches` | id, type (2 / 3), status (abierto, confirmado, en operación, cerrado, caducado), created_at |
| `match_participants` | match_id, home_id, user_id, gives_home_id, receives_home_id, compensation, status (pendiente, confirma, se retira) |
| `operations` | id, match_id, agency_id, status, signed_at, fee_amount |
| `agencies` | id, name, cif, zones, contact, active |
| `documents` | id, operation_id, uploaded_by, type, storage_path |
| `reports` | id, reporter_id, target_type, target_id, reason, status |
| `consents` | user_id, type, version, accepted_at |
| `audit_log` | id, actor_id, action, entity, entity_id, at |
| `waitlist` | email, municipality, home_type, looking_for, consent_at |

---

## 11 · Algoritmo de emparejamiento

Grafo dirigido: **nodo** = vivienda; **arista A→B** = el propietario de A da *like* a B y B
cumple las preferencias de A.

Cuando se crea la arista `(X → Y)`, se buscan los ciclos que la contienen:

```sql
-- Ciclo de 2: X → Y → X
SELECT l.from_home_id
FROM likes l
WHERE l.from_home_id = :y AND l.to_home_id = :x;

-- Ciclo de 3: X → Y → Z → X
SELECT l1.to_home_id AS z
FROM likes l1
JOIN likes l2 ON l2.from_home_id = l1.to_home_id AND l2.to_home_id = :x
WHERE l1.from_home_id = :y
  AND l1.to_home_id NOT IN (:x, :y);
```

Para cada ciclo candidato, el dominio calcula la **compensación** de cada participante
(valor recibido − valor entregado) y valida **RN-03**. Si todos son compatibles, se crea el
match. Debe evitarse crear matches duplicados del mismo ciclo (clave canónica: conjunto
ordenado de viviendas).

Requisitos del algoritmo:

- Índices en `likes(from_home_id)` y `likes(to_home_id)`.
- Ejecución transaccional y concurrencia segura (dos likes simultáneos no crean el mismo match dos veces).
- Pruebas basadas en propiedades: la suma de compensaciones de un ciclo es siempre 0; ningún match viola los límites de pago/cobro; no se generan ciclos de longitud > 3.

---

## 12 · Infraestructura y despliegue

| Elemento | Valor |
|---|---|
| Nube | **Google Cloud + Firebase** |
| Región | `europe-southwest1` (Madrid) |
| Cómputo | Cloud Run (API, contenedor Docker) |
| Base de datos | Cloud SQL for PostgreSQL 17 + PostGIS, copias automáticas diarias |
| Registro de imágenes | Artifact Registry |
| Secretos | Secret Manager |
| Hosting estático | Firebase Hosting (landing y app web) |
| Entornos | `DES → PROD` |
| Aprobación | Manual para producción |
| Integración continua | GitHub Actions |
| Infraestructura como código | Terraform (fase 2; scripts `gcloud` en el MVP) |
| Publicación en tiendas | EAS Submit a Google Play y App Store |

### Coste estimado del MVP

| Concepto | Coste |
|---|---|
| Apple Developer Program | 99 $/año |
| Google Play Console | 25 $ (pago único) |
| Cloud SQL (instancia mínima) | ~10–30 €/mes |
| Cloud Run, Firebase, Storage | ~0 € dentro de niveles gratuitos |
| Dominio | ~10–15 €/año |
| **Total aproximado** | **~150 € primer año + 15–35 €/mes** |

---

## 13 · Cumplimiento legal

| Ámbito | Requisito |
|---|---|
| **Fiscalidad** | La plataforma ofrece **estimaciones orientativas** y nunca recomienda valores de escritura. Los valores deben ser valores de mercado defendibles (tasación homologada, ≥ valor de referencia). Validación final por la gestoría. |
| **VPP** | Respetar precio máximo legal, visado/autorización de la Comunidad de Madrid, derecho de tanteo y retracto y requisitos del adquirente. Pendiente confirmar si el tanteo y retracto aplica a la **permuta**. |
| **Datos registrales** | Las notas simples prohíben incorporar sus datos a ficheros de consulta. Solo se usan para **verificar** la titularidad aportada por el propio usuario; no se construye una base de datos consultable con ellas. Validar con abogado. |
| **RGPD / LOPDGDD** | Base legal por tratamiento, registro de actividades, EIPD, contratos de encargado con proveedores (Google, Stripe, Sentry…). |
| **LSSI** | Aviso legal, política de cookies y consentimiento. |
| **Intermediación inmobiliaria** | Verificar si alguna comunidad autónoma exige inscripción en registro de agentes inmobiliarios según el grado de intermediación. |
| **Tiendas de aplicaciones** | Directrices de Apple y Google: login equivalente a Apple si se ofrece login social, eliminación de cuenta desde la app, política de privacidad. |
| **Consumidores** | Términos claros sobre la comisión de éxito: cuándo se devenga y cómo se cancela. |

---

## 14 · Métricas de éxito

| Métrica | Objetivo inicial (Madrid, primeros 6 meses tras el MVP) |
|---|---|
| Viviendas publicadas | 1.000 |
| % de viviendas con ≥1 match | 30 % |
| Matches de 3 sobre el total | ≥ 15 % |
| Matches → operación | 5 % |
| Operaciones firmadas | 10 |
| Gestorías asociadas activas | 5 |

---

## 15 · Riesgos

| Riesgo | Mitigación |
|---|---|
| Arranque en frío: pocas viviendas por zona | Lanzar en una zona acotada (Madrid y área metropolitana), lista de espera previa, emparejamiento asistido manual al inicio |
| Baja frecuencia de uso | Notificaciones de nuevas viviendas compatibles y alertas por zona |
| Diferencias de valor difíciles de financiar | Derivación a broker hipotecario; mostrar compensación desde el primer momento |
| Cadenas que no se cierran | Máximo 3 participantes; confirmación explícita de cada uno; gestoría única por operación |
| Uso fiscal indebido | RN-07; comunicación centrada en ahorro de agencia; tasación obligatoria en la operación |
| Fraude o anuncios falsos | Moderación, verificación de titularidad y KYC antes de operar |
| Dependencia de un solo desarrollador | Documentación (este README, `docs/`, OpenSpec), TDD y CI desde el inicio |

---

## 16 · Decisiones pendientes

| Tema | Opciones | Estado |
|---|---|---|
| Repositorio y CI | — | ✅ GitHub + GitHub Actions (el *harness* se ha adaptado a GitHub y a Claude Code) |
| Revisión de código | — | ✅ CodeRabbit en las pull requests de GitHub |
| Gestor de tareas | — | ✅ GitHub Issues + GitHub Projects |
| Rama base / producción | — | ✅ `develop` / `master` |
| Proveedor de email transaccional | — | ✅ Extensión Trigger Email de Firebase con SMTP de Gmail (provisional) |
| Proveedor de KYC | Veriff · Onfido · Didit | Fase 2 |
| Importe de la comisión de éxito | Fijo por parte vs. porcentaje | Validar con usuarios y gestorías |
| Portal de gestoría | Dentro de la app web de Expo vs. aplicación web separada | Fase 2 |
| Fuente de datos de precios de cierre | Notariado, Registradores, proveedores privados | Fase 3 |
| Tanteo y retracto de VPP en permutas | Consulta jurídica | ⚠️ PENDIENTE |

---

## 17 · Glosario

| Término | Definición |
|---|---|
| **Permuta** | Contrato por el que dos o más partes intercambian bienes (arts. 1538–1541 del Código Civil); puede incluir una compensación en dinero |
| **Match** | Ciclo de interés recíproco y económicamente compatible entre 2 o 3 viviendas |
| **Compensación** | Diferencia de valor que paga o recibe cada participante de un match |
| **VPP / VPPB / VPPL / VPO** | Viviendas con protección pública (básica, de precio limitado) y de protección oficial, con precio máximo legal y restricciones de transmisión |
| **Valor de referencia** | Valor fijado por el Catastro; base mínima del ITP desde 2022 |
| **Nota simple** | Extracto informativo del Registro de la Propiedad: titularidad, descripción y cargas |
| **CRU** | Código Registral Único de una finca |
| **ITP** | Impuesto de Transmisiones Patrimoniales, lo paga quien adquiere |
| **Plusvalía municipal** | Impuesto sobre el incremento de valor de los terrenos de naturaleza urbana |
| **Exención por reinversión** | Exención en IRPF de la ganancia por transmitir la vivienda habitual si se reinvierte en otra vivienda habitual |

---

## Licencia

Copyright © 2026 lcasadov — ChangeHouse. **Todos los derechos reservados.** El repositorio es
público solo para consulta; ver [`LICENSE`](LICENSE).

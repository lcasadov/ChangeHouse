# ChangeHouse — Estrategia de pruebas

> **Documento autoritativo** de umbrales y estrategia de pruebas. Si
> `docs/project.md` §5 discrepa, manda este documento y aquel se corrige.
>
> Fuentes: `docs/project.md`, `docs/rbac-matrix.md`, `docs/datamodel.md`,
> `docs/api/openapi.yaml` y README §7 y §11. **Aún no hay código ni pruebas**:
> esto es la estrategia de partida, no una descripción del estado actual.

---

## Resumen previo

| Aspecto | Valor |
|---|---|
| Lenguaje | TypeScript 5 `strict`, Node.js 24 LTS, monorepo pnpm + Turborepo |
| Servidor | Fastify, hexagonal (`services/api`) |
| Persistencia | PostgreSQL 17 + PostGIS con Drizzle; chat en Firestore |
| Cliente | Expo (React Native) + Expo Router; landing Astro |
| CI | GitHub Actions; puerta: checks requeridos + revisión de CodeRabbit |
| Pruebas | Vitest, fast-check, Testcontainers, React Native Testing Library, Playwright, Maestro |

**Reglas críticas de negocio** (las que más duele romper):

- Matching: ciclos de 2 y 3 únicamente (RN-05); compatibilidad económica
  (RN-03); suma de compensaciones cero (RN-04); sin matches duplicados del mismo
  ciclo, incluso con likes concurrentes.
- Visibilidad: dirección exacta y contacto solo para participantes (RN-08); VPP
  solo para quien cumple requisitos (RN-06); viviendas en operación fuera del
  descubrimiento (RN-11).
- Permisos: las 19 reglas críticas RC-01…RC-19 de `docs/rbac-matrix.md`.
- Nunca se proponen valores de escritura (RN-07).

**Normativa** (`$NORMATIVA`): RGPD/LOPDGDD (consentimiento registrado,
supresión con anonimización, exportación, minimización), LSSI, OWASP ASVS 2,
MASVS, WCAG 2.2 AA.

**Reglas de implementación verificables**: fronteras hexagonales I-1…I-9
(`docs/architecture.md` §4); errores en `Problem` con `correlationId`
(`openapi.yaml`); auditoría obligatoria de acciones administrativas (RC-15).

**Flujos críticos**: like → detección de ciclo → match → notificación; confirmar
o retirarse de un match; publicación con moderación.

**Estado actual**: ninguna prueba (proyecto sin código).

**Preguntas abiertas** (marcadas como pendientes; no bloquean la estrategia):

| Pregunta | Estado |
|---|---|
| Volumetría de likes por usuario y día | ⚠️ PENDIENTE — sin ella no hay pruebas de carga realistas |
| Concurrencia esperada en picos | ⚠️ PENDIENTE |
| Entorno de pruebas E2E: ¿DES compartido o efímero por PR? | ⚠️ PENDIENTE — por defecto, E2E contra DES |
| Datos realistas | No se usan datos de producción: solo sintéticos (ver §5) |

---

## 1 · Pirámide de pruebas

| Nivel | Proporción orientativa | Qué valida | Dobles | Presupuesto de tiempo |
|---|---|---|---|---|
| **Unitarias de dominio** (incluye propiedades) | ~60 % | Reglas RN-*, detector de ciclos sobre grafos en memoria, compensaciones, estados de match y vivienda, simulador fiscal | Ninguno: el dominio es puro | < 10 ms por prueba; suite < 30 s |
| **Unitarias de aplicación** | ~15 % | Casos de uso: orquestación, autorización por caso de uso, eventos | Puertos sustituidos por dobles en memoria | < 50 ms por prueba |
| **Integración de persistencia** | ~10 % | Repositorios Drizzle, consultas de ciclos, restricciones del esquema, concurrencia | **PostgreSQL + PostGIS real** en Testcontainers | < 3 min la suite |
| **Integración HTTP (API)** | ~8 % | Rutas Fastify contra el contrato OpenAPI, códigos de estado, matriz RBAC completa | Firebase Auth sustituido por un verificador de tokens de prueba; BD real | < 3 min la suite |
| **Componentes (app)** | ~5 % | Pantallas y componentes con React Native Testing Library: estados de carga, error y vacío, temas, accesibilidad | API sustituida en la frontera HTTP (MSW o equivalente) | < 2 min la suite |
| **E2E** | ~2 % | Flujos críticos completos: web con Playwright, móvil con Maestro | Ninguno: entorno DES | < 15 min; solo en PR hacia `master` y antes de desplegar en PROD |

## 2 · Política de dobles de prueba

**Permitido:**

- Sustituir **puertos** (`HomeRepository`, `Notifier`, `PaymentGateway`…) por
  implementaciones en memoria en las pruebas de aplicación.
- Sustituir sistemas externos (Firebase Auth, FCM, Stripe, email, Google
  Places) en las pruebas propias, con pruebas de contrato aparte cuando
  exista el adaptador.
- Emulador de Firestore (Firebase Emulator Suite) para probar las reglas de
  seguridad del chat (RC-16).
- Reloj inyectable (`Clock`) para caducidades y límites diarios.

**Prohibido en este proyecto:**

- ❌ Sustituir PostgreSQL por SQLite, pg-mem u otra base de datos en memoria:
  el detector de ciclos, PostGIS y las restricciones dependen del dialecto real.
- ❌ Hacer *mock* de Drizzle, Fastify o del cliente HTTP: se sustituye el puerto,
  no la tecnología.
- ❌ Dobles en las pruebas del dominio: si el dominio necesita un doble, ha
  importado infraestructura (viola I-1).
- ❌ Llamar a servicios externos reales (Stripe, FCM, email) desde las pruebas
  automáticas.
- ❌ Pruebas que dependan del orden de ejecución o de datos dejados por otra.

## 3 · Umbrales y puerta de calidad

| Variable | Valor |
|---|---|
| `$COVERAGE_THRESHOLD` | **80 %** |
| `$COVERAGE_SCOPE` | Código nuevo |
| `$NEW_CODE_DEFINITION` | Líneas añadidas o modificadas por la Pull Request respecto a su rama de destino |
| `$QG_PROVIDER` | CodeRabbit |
| `$QG_LEVEL` | N/A |

| Métrica | Código nuevo | Código existente | Cómo se verifica |
|---|---|---|---|
| Cobertura de líneas y ramas | ≥ 80 % | ≥ 80 % (no puede empeorar) | Umbral de cobertura de Vitest (`coverage.thresholds`) en cada paquete; falla el job |
| Errores de lint y de tipos | 0 | 0 | `pnpm lint`, `pnpm typecheck` en CI |
| Pruebas en rojo u omitidas | 0 | 0 | Vitest falla con `.only`; regla de lint contra `.skip` y `.only` |
| Hallazgos de CodeRabbit sin atender | 0 | — | Conversaciones resueltas (protección de rama) |
| Dependencias con vulnerabilidad crítica | 0 | 0 | Escaneo de dependencias en CI (⚠️ herramienta por concretar en el workflow) |

Proyecto nuevo: **todo el código es código nuevo**, así que el 80 % aplica al
conjunto desde el primer commit.

El umbral es **condición de entrada**, no un objetivo: un cambio por debajo
del 80 % no está terminado. Y la cobertura indica **ausencia**: señala lo que no
se ha ejecutado, pero no garantiza que lo ejecutado se haya comprobado bien.
Por eso se exige además una prueba por escenario (§4) y pruebas de propiedades
(§8).

Exclusiones de cobertura permitidas (y solo estas): ficheros de configuración,
tipos puros (`*.d.ts`), migraciones generadas y el punto de entrada `main.ts`.
Añadir otra exclusión es decisión de una persona.

## 4 · Correspondencia requisito ↔ prueba

- Cada `#### Scenario:` de un spec de OpenSpec tiene **al menos una** prueba.
- La prueba se nombra con el escenario, para que la relación se vea sin leer el
  cuerpo:

```ts
describe('matching / detección de ciclos', () => {
  it('Scenario: like recíproco compatible crea un match directo', () => { … });
  it('Scenario: cadena de tres compatible crea un match en cadena', () => { … });
});
```

- Las reglas de negocio llevan su identificador cuando no hay escenario aún:
  `it('RN-04: la suma de compensaciones de un ciclo es cero', …)`.
- `/opsx:verify` comprueba que cada escenario del change tiene su prueba.
- En `tasks.md`, la tarea de prueba precede a la de implementación (TDD,
  regla 10 de `CLAUDE.md`).

## 5 · Datos de prueba

- **Solo datos sintéticos.** No se copian ni se derivan datos de producción.
- Constructores (*builders*) por entidad en cada paquete (`aHome().vpp().build()`),
  con valores por defecto válidos; la prueba solo fija lo que le importa.
- Persistencia: cada prueba corre en una transacción que se revierte, o en un
  esquema limpio por fichero. Un contenedor de PostgreSQL por ejecución de la
  suite, con las migraciones reales aplicadas.
- Geografía: coordenadas ficticias en Madrid; nunca direcciones reales de
  personas.
- E2E en DES: usuarios de prueba por rol creados por un script idempotente;
  emails con dominio reservado (`@example.com`).

## 6 · Pruebas de seguridad y de permisos

- **Matriz completa**: una prueba parametrizada de integración HTTP recorre
  `services/api/test/authorization/rbac-matrix.json` (todas las operaciones ×
  actores) y falla en la celda violada. Una operación del contrato sin filas
  hace fallar la prueba.
- Cada regla crítica tiene su caso **negativo** explícito:

| Regla | Prueba (caso negativo) |
|---|---|
| RC-01 | Cada operación sin token → 401 (salvo `joinWaitlist`) |
| RC-02 | `seeker` → `likeHome` → 403 |
| RC-03 | Usuario B → `updateHome` sobre vivienda de A → 404 |
| RC-04 | `getHome` de vivienda ajena sin match → la respuesta no contiene `address`; con `locationVisibility: area`, `location.point` es el centro del barrio o zona |
| RC-05/06 | No participante → `getMatch`/`confirmMatch` → 404 |
| RC-07 | Vivienda ajena en `draft` → `getHome` → 404 |
| RC-08 | Usuario sin requisitos VPP → `discoverHomes` no devuelve viviendas VPP |
| RC-09 | Vivienda `in_operation` → nunca en `discoverHomes` |
| RC-10 | `owner` → cada `/admin/*` → 403 |
| RC-11 | Participante sin autorización → `phone` es `null` para los demás |
| RC-12 | Like a vivienda propia → 422 |
| RC-13 | Like n.º límite + 1 en el día → 429 |
| RC-14 | `admin` → `likeHome`, `createHome` → 403 |
| RC-15 | Moderación y suspensión → existe la entrada en `audit_log` |
| RC-16 | Reglas de Firestore en el emulador: no participante no lee ni escribe el chat |
| RC-17 | Enviar `status`, `ownerId` o roles en el cuerpo → 400 o se ignora |
| RC-18 | `likeHome` con `fromHomeId` ajena → 404; con vivienda propia no publicada → 409 |
| RC-19 | `agency` y `admin` → `createHome` → 403 |

- Validación de entrada: pruebas de los esquemas Zod con valores límite y
  maliciosos.
- Errores: ninguna respuesta de error contiene trazas, SQL ni nombres de tabla.
- DAST asistido por IA contra DES antes de cada entrega a PROD (`$DAST_TOOL`).

## 7 · Ejecución

| Comando | Qué ejecuta | Estado |
|---|---|---|
| `pnpm test` (`$TEST_UNIT_CMD`, `$TEST_CMD`) | Unitarias y de componentes de todos los paquetes | ⚠️ SUPUESTO (README) |
| `pnpm test:coverage` (`$COVERAGE_CMD`) | Lo anterior con cobertura y umbral | ⚠️ SUPUESTO (README) |
| `pnpm test:integration` (`$TEST_INTEGRATION_CMD`) | Integración con Testcontainers y el emulador de Firebase Auth, que arranca `firebase emulators:exec`. Con el emulador ya en marcha (`pnpm emulators`): `pnpm test:integration:run`. En local, si el emulador no responde, se omiten con aviso solo las pruebas que lo necesitan; en la CI (`CI=true`) su ausencia es un error | verificado 2026-10-19 |
| `pnpm test:e2e` (`$TEST_E2E_CMD`) | Playwright (web) y Maestro (móvil) | ⚠️ SUPUESTO (decidido; se verifica con el scaffold) |

| Momento | Qué se ejecuta |
|---|---|
| Local, durante TDD | Pruebas del paquete afectado en modo *watch* |
| Antes de commit | Lint, tipos y pruebas afectadas (regla `static-analysis`) |
| PR hacia `develop` | Lint, tipos, unitarias, integración, cobertura, escaneo de dependencias, `openspec-sync` |
| PR hacia `master` / antes de PROD | Todo lo anterior + E2E contra DES + DAST |

**Pruebas intermitentes**: se corrigen o se retiran con un issue `tipo:bug`
asociado; nunca se reintentan automáticamente ni se marcan como omitidas para
pasar la puerta.

## 8 · Pruebas basadas en propiedades

`$PROPERTY_TESTING_LIB`: **fast-check**. Obligatorias (RNF-33) en:

| Ámbito | Propiedades |
|---|---|
| Compensaciones | La suma de compensaciones de un ciclo es siempre 0 (RN-04); cada compensación es (valor recibido − valor entregado) |
| Compatibilidad económica | Ningún match aceptado viola el máximo a pagar ni el mínimo a recibir de ningún participante (RN-03), con el punto de referencia del rango elegido por cada usuario (`valueReferencePct`) |
| Detector de ciclos | Sobre grafos aleatorios: nunca devuelve ciclos de longitud > 3 (RN-05); todo ciclo devuelto existe en el grafo; un ciclo y sus rotaciones producen la misma clave canónica |
| Idempotencia | Crear el mismo ciclo dos veces (o por likes concurrentes) produce un único match |
| VPP | Ninguna vivienda VPP aceptada supera su precio máximo legal (RN-06) |
| Simulador fiscal (fase 2) | Monotonía: más ganancia nunca da menos IRPF; las exenciones nunca producen impuesto negativo |
| Transformaciones reversibles | Cifrado y descifrado de la dirección exacta; serialización de cursores de paginación |

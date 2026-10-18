# AGENTS.md — $PROJECT_NAME

> Plantilla. Se instancia con el prompt `16-generate-agents-md` a partir de
> `docs/project.md`. **No copies este fichero tal cual al proyecto destino**: sus
> variables deben quedar resueltas. Un `AGENTS.md` con `$VARIABLE` sin sustituir
> es peor que no tenerlo, porque el agente lo lee como si fuera literal.
>
> Va en la **raíz** del repositorio, nunca en `openspec/`. Los `AGENTS.md`
> se resuelven por subárbol: uno colocado en `openspec/` solo se aplicaría al
> editar specs, y quedaría invisible justo al escribir código.
>
> Borra este bloque al instanciar.

---

Léelo antes de cualquier acción. Complementa al `README.md`: el README es para
personas, esto es para agentes.

## Qué es este proyecto

$PROJECT_DESCRIPTION

- **Stack**: $LANGUAGE · $FRAMEWORK · $UI_FRAMEWORK · $DB
- **Repositorio**: $REPO_ID en $VCS_PROVIDER
- **Rama base**: $BASE_BRANCH · **Producción**: $PROD_BRANCH

## Comandos

| Acción | Comando |
|---|---|
| Instalar dependencias | $INSTALL_CMD |
| Arrancar en local | $RUN_CMD |
| Compilar y verificar | $BUILD_VERIFY_CMD |
| Ejecutar las pruebas | $TEST_CMD |
| Cobertura | $COVERAGE_CMD |
| Análisis estático | $LINT_CMD |

Ejecuta `$BUILD_VERIFY_CMD` y `$TEST_CMD` **antes de dar por terminado**
cualquier cambio. No informes de trabajo completado sin haberlos pasado.

## Modelo de trabajo

```
docs/project.md → contrato de variables del proyecto
OpenSpec        → requisitos y decisiones de diseño
$TRACKER        → gestión de tareas y elementos de trabajo
Código          → implementación y evidencia
```

OpenSpec es la fuente única de verdad de **qué** hay que construir y **por qué**.
El código implementa lo que OpenSpec especifica. El gestor de trabajo rastrea el
avance. Las pruebas son la evidencia.

> **⛔ Si necesitas un dato que no está en `docs/project.md`, para y pregunta.**
> No lo inventes, no lo deduzcas del código, no uses un valor por defecto.

## Antes de empezar, lee

1. **`docs/project.md`** — el contrato: rutas, comandos, umbrales, convenciones.
2. **`openspec/PLAN.md`** — estado global: qué está hecho, qué está en curso.
   Lo regeneran las extensiones de OpenSpec; no lo edites fuera de la zona curada.
3. **El change asignado** en `openspec/changes/<slug>/`: `proposal.md` (por qué),
   `design.md` (cómo), `tasks.md` (tus tareas `[ ]`), `specs/` (criterios).
4. **El spec consolidado** relacionado en `openspec/specs/<capability>/spec.md`.

## Quién hace qué

Para **coordinar** trabajo que cruza varias áreas —crear la rama, abrir el
elemento de trabajo, repartir entre especialistas, abrir la propuesta de
integración— **invoca al agente orquestador** (`$AGENTS_PATH`). Este fichero
describe el terreno; el orquestador es quien dirige.

| Agente | Cuándo |
|---|---|
| Orquestador | Coordinación, ramas, PRs, elementos de trabajo |
| Backend | Servicios, endpoints, dominio, persistencia, seguridad de servidor |
| Frontend | Interfaz, estado, integración con la API, accesibilidad |
| Tester | Estrategia de pruebas, cobertura, verificación de calidad |
| DevOps | Pipelines, entornos, despliegues, secretos |
| Security | Auditoría, permisos, dependencias vulnerables |

## Reglas absolutas

| Regla | Descripción |
|---|---|
| ⛔ Rama antes de código | Ningún fichero se modifica sin una rama dedicada activa |
| ⛔ El origen de la rama depende de su tipo | Un `hotfix` nace de `$PROD_BRANCH`, no de `$BASE_BRANCH` |
| ⛔ Elemento de trabajo requerido | Todo cambio de implementación tiene su elemento en `$TRACKER` |
| ⛔ No inventar contratos | Endpoints, campos, roles y estados salen de `$API_CONTRACT` o del diseño |
| ⛔ No marcar `[x]` sin evidencia | Solo con implementación confirmada y pruebas en verde |
| ⛔ No implementar fuera del alcance | Trabajo nuevo detectado → nuevo change, no ampliación silenciosa |
| ⛔ No disparar versionado por accidente | Nunca uses `$VERSION_BUMP_KEYWORDS` sin decisión expresa |
| ✅ Pruebas antes que código | El comportamiento nuevo se describe con una prueba que falla primero |
| ✅ Specs antes que código | Si la implementación diverge del spec, se actualiza el spec primero |
| ✅ Trazabilidad | El identificador del elemento de trabajo aparece en la rama y en el commit |

## Ramas

| Tipo | Se crea desde | Se integra en |
|---|---|---|
| `feature/<id>-<slug>` | `$BASE_BRANCH` | `$BASE_BRANCH` |
| `bugfix/<id>-<slug>` | `$BASE_BRANCH` | `$BASE_BRANCH` |
| `hotfix/<id>-<slug>` | **`$PROD_BRANCH`** | **`$PROD_BRANCH` y `$BASE_BRANCH`** |
| `release/<versión>` | `$BASE_BRANCH` | `$PROD_BRANCH` |

Un elemento de trabajo, una rama. Si intervienen varios agentes en el mismo
elemento, comparten rama. En un proyecto multirepo, la misma rama existe en cada
repositorio enlazado: ver el skill `rama-espejo`.

## Convenciones de código

- Arquitectura: $ARCH_STYLE
- Estilo y formato: $CODE_STANDARDS_DOC
- Calidad por stack: `.claude/skills/code-quality/SKILL.md`
- Cobertura mínima: `$COVERAGE_THRESHOLD` sobre código nuevo

## Propuestas de integración

- Título: incluye el identificador del elemento de trabajo,
  **sin palabras que disparen versionado**.
- Revisor obligatorio: `$REVIEWER`.
- No se abre con la integración continua en rojo ni con la cobertura por debajo
  del umbral.

## Cómo informar del trabajo

```
## Ficheros modificados
- <ruta>: <qué cambió y por qué>

## Pruebas añadidas o modificadas
- <ruta>: <qué cubre> — estado

## Verificación ejecutada
- <comando>: <resultado>

## Preguntas abiertas
- <pregunta o «ninguna»>
```

Si algo no se pudo verificar, **dilo**. Un informe que omite lo no comprobado es
un informe falso.

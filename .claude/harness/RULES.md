# Catálogo de reglas (`.claude/rules/`)

Reglas de codificación que Claude Code carga automáticamente cuando trabaja con
ficheros que coinciden con los `paths` de su frontmatter. Las que no declaran
`paths` se cargan siempre.

Todas son **genéricas**: no asumen
lenguaje, framework, base de datos ni infraestructura. Lo específico del
proyecto se referencia como `$VARIABLE` y se resuelve leyendo `docs/project.md`.

> **Si una variable no está definida en `docs/project.md`, para y pregunta.
> No la inventes.**

## Ficheros

| Fichero | Ámbito |
|---|---|
| `backend-controllers.md` | Adaptadores de entrada del servidor: mapeo de DTO, códigos de estado, seguridad del endpoint |
| `backend-services.md` | Casos de uso y servicios de dominio: fronteras de capa, transacciones, validación |
| `backend-security-crosscutting.md` | Infraestructura de seguridad: configuración central, filtros, evaluadores de permisos |
| `backend-auth-services-security.md` | Servicios de autenticación y autorización fuera de la configuración central |
| `frontend-components.md` | Componentes, páginas y vistas: nomenclatura, tematización, tests |
| `frontend-hooks.md` | Lógica de interfaz reutilizable (hooks, composables): efectos, estado, errores |
| `frontend-services.md` | Adaptadores de salida de API: contrato, mapeo, normalización de errores |
| `frontend-ux-a11y.md` | UX, accesibilidad, internacionalización y comportamiento adaptable (transversal) |
| `openspec-rules.md` | Artefactos OpenSpec: delta vs consolidado, escenarios BDD, orden TDD de tareas |
| `anti-hallucination.md` | Todo el código: verificar antes de afirmar, no inventar contratos, tipos ni permisos |
| `static-analysis.md` | Lint, tipos, cobertura y revisión de CodeRabbit; realimentación al skill de calidad (global) |
| `ci-cd-conventions.md` | Workflows de GitHub Actions e infraestructura: nomenclatura, secretos, puertas bloqueantes, promoción |

## `paths`: se ajustan a mano

Los `paths` son globs literales: **no admiten variables**. Los valores actuales
son los genéricos del catálogo (`backend/`, `server/`, `api/`, `frontend/`,
`web/`, `client/`, `ui/`, `src/`, `apps/*/src/`…).

**No hay CLI que los regenere.** Cuando `docs/project.md` fije `$SRC_ROOT`, `$FRONTEND_ROOT`,
`$PIPELINE_DIR` u `$OPENSPEC_PATH`, ajusta a mano los `paths` de las reglas
afectadas a la estructura real (por ejemplo, `services/api/src/**` o
`apps/mobile/**` según el README). El comando `/harness:15-verify-contract`
comprueba que cada patrón casa con algún fichero.

- Si una sección de `docs/project.md` vale `N/A` (por ejemplo, no hay interfaz),
  elimina las reglas correspondientes en lugar de dejarlas huérfanas.
- `static-analysis.md` no declara `paths` de forma deliberada: la revisión se
  hace al cerrar cualquier tarea, sea cual sea el fichero tocado.

## Variables usadas

| Variable | Usada en |
|---|---|
| `$COVERAGE_THRESHOLD` | todas |
| `$API_CONTRACT` | backend-controllers, frontend-services |
| `$AUTH_MECHANISM` | backend-security-crosscutting |
| `$UI_FRAMEWORK` | frontend-components, frontend-hooks |
| `$HTTP_CLIENT` | frontend-services |
| `$STYLE_GUIDE_DOC` | frontend-components, frontend-ux-a11y |
| `$THEMES` | frontend-components, frontend-ux-a11y |
| `$I18N` | frontend-components, frontend-ux-a11y |
| `$A11Y_LEVEL` | frontend-ux-a11y |
| `$BROWSER_MATRIX` | frontend-ux-a11y |
| `$TRACKER`, `$TICKET_PREFIX` | openspec-rules |
| `$RBAC_MATRIX_DOC` | anti-hallucination |
| `$LINT_CMD`, `$TYPECHECK_CMD`, `$COVERAGE_CMD`, `$QG_PROVIDER`, `$QUALITY_GATE` | static-analysis |
| `$CI_PROVIDER`, `$PIPELINE_DIR`, `$ENVIRONMENTS`, `$DEPLOY_TARGET`, `$QUALITY_GATE` | ci-cd-conventions |
| `$VERSIONING_TOOL`, `$VERSION_BUMP_KEYWORDS`, `$BASE_BRANCH`, `$PROD_BRANCH` | ci-cd-conventions |

`docs/TESTING-STRATEGY.md` es la fuente autoritativa de cobertura en todos los ficheros.

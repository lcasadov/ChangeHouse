# Perfil de Habitinder — Puerta de calidad

> La puerta se compone de **checks de GitHub Actions** y de la revisión
> automática de **CodeRabbit**.
>
> ⚠️ **El repositorio es privado y sin GitHub Pro: no hay protección de rama.**
> GitHub no impide fusionar con la CI en rojo ni con comentarios abiertos. La
> puerta se cumple por proceso: ver «Verificación antes de fusionar».

## Componentes de la puerta

| Control | Herramienta | Bloquea |
|---|---|---|
| Lint y formato | `$LINT_CMD` en GitHub Actions | Check en verde |
| Comprobación de tipos | `$TYPECHECK_CMD` en GitHub Actions | Check en verde |
| Pruebas | `$TEST_CMD` en GitHub Actions | Check en verde |
| Cobertura sobre código nuevo | `$COVERAGE_CMD` con umbral configurado en la herramienta | Check en verde |
| Dependencias vulnerables | Escaneo de dependencias en la CI (severidad crítica) | Check en verde |
| Coherencia de OpenSpec | `openspec-sync` en GitHub Actions | Check en verde |
| Revisión automática | CodeRabbit (`coderabbitai[bot]`) | Cero conversaciones abiertas y revisión no en *changes requested* |

## Umbrales

### Código nuevo — condición de entrada

| Métrica | Umbral |
|---|---|
| Errores de lint | `0` |
| Errores de tipos | `0` |
| Pruebas en rojo u omitidas | `0` |
| Cobertura | `≥ 80 %` |
| Hallazgos de CodeRabbit sin atender | `0` (corregidos o respondidos con razón en el hilo) |
| Dependencias con vulnerabilidad crítica | `0` |

### Código existente

| Métrica | Umbral |
|---|---|
| Cobertura | `≥ 80 %` (objetivo; no puede empeorar) |
| Errores de lint y de tipos | `0` |

> Duplicación y calificaciones de mantenibilidad, fiabilidad y seguridad **no se
> miden** en este proyecto. No las cites como umbral: no hay
> herramienta que las compruebe.

## Lectura correcta de estos umbrales

El umbral sobre **código nuevo** no es un objetivo al que tender: es una
**condición de entrada**. Código que no lo cumple no se integra. No existe un
plan de subida progresiva.

El umbral sobre **código existente** describe el estado deseado del repositorio.
Lo que no puede es empeorar. Cada cambio deja el conjunto igual o mejor.

## Requisitos de configuración

- El umbral de cobertura se configura **en la herramienta de pruebas** (por
  ejemplo, `coverage.thresholds` en Vitest), para que el propio comando falle.
- CodeRabbit debe estar instalado en el repositorio y su configuración
  (`.coderabbit.yaml`) debe cubrir `$BASE_BRANCH` y `$PROD_BRANCH` como ramas de
  destino. Con `request_changes_workflow: true` su revisión pide cambios y
  aprueba al resolverse.

## Verificación antes de fusionar

Sin protección de rama, **nadie fusiona una Pull Request** (`gh pr merge` ni
desde la web) sin comprobar antes, y dejar constancia en la respuesta, de:

```bash
gh pr checks <PR>                       # todos en verde, ninguno pendiente
gh pr view <PR> --json reviewDecision,reviews \n  --jq '.reviews[] | select(.author.login=="coderabbitai") | .state'   # último estado: APPROVED o COMMENTED, nunca CHANGES_REQUESTED
gh api graphql -f query='query($o:String!,$r:String!,$n:Int!){repository(owner:$o,name:$r){pullRequest(number:$n){reviewThreads(first:100){nodes{isResolved}}}}}' \n  -F o=lcasadov -F r=Habitinder -F n=<PR> \n  --jq '[.data.repository.pullRequest.reviewThreads.nodes[]|select(.isResolved==false)]|length'   # debe ser 0
```

Si algo no cumple, la PR **no se fusiona**: se corrige la causa. Los agentes
tienen prohibido fusionar; lo hace una persona tras esta verificación.

> Si en el futuro se contrata GitHub Pro o el repositorio pasa a público, hay
> que activar la protección de rama de `$BASE_BRANCH` y `$PROD_BRANCH` (checks
> requeridos, *Require conversation resolution before merging*, aplicada a
> administradores) y *required reviewers* en el environment `PROD`.

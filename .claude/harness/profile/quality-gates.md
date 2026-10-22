# Perfil de ChangeHouse — Puerta de calidad

> La puerta se compone de **checks de GitHub Actions** y de la revisión
> automática de **CodeRabbit**, ambos exigidos por la protección de rama de
> `$BASE_BRANCH` y `$PROD_BRANCH`.

## Componentes de la puerta

| Control | Herramienta | Bloquea |
|---|---|---|
| Lint y formato | `$LINT_CMD` en GitHub Actions | Check requerido |
| Comprobación de tipos | `$TYPECHECK_CMD` en GitHub Actions | Check requerido |
| Pruebas | `$TEST_CMD` en GitHub Actions | Check requerido |
| Cobertura sobre código nuevo | `$COVERAGE_CMD` con umbral configurado en la herramienta | Check requerido |
| Dependencias vulnerables | Escaneo de dependencias en la CI (severidad crítica) | Check requerido |
| Coherencia de OpenSpec | `openspec-sync` en GitHub Actions | Check requerido |
| Revisión automática | CodeRabbit (`coderabbitai[bot]`) | Cero conversaciones abiertas y revisión sobre el HEAD en estado `APPROVED` o `COMMENTED` |

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
- **La revisión se pide a mano.** En este repositorio CodeRabbit omite la
  revisión automática; su aviso dice literalmente «This repository does not
  receive automatic reviews because it has fewer than 10 stars» (observado el
  2026-10-18 en la PR #5). Su check sale en verde con «Review skipped» **sin
  haber revisado**. Al abrir la PR, y cuando
  su HEAD sea definitivo, comenta `@coderabbitai review` (o `@coderabbitai full
  review`). Un push posterior al comentario lo anula («Head commit changed»): hay
  que volver a pedirla. **Un check verde de CodeRabbit no es una revisión.**

## Protección de rama

`$BASE_BRANCH` y `$PROD_BRANCH` están protegidas (configurado el 2026-10-18):

- Cambios solo mediante Pull Request; sin *force push* ni borrado.
- *Require conversation resolution before merging*: cada comentario de
  CodeRabbit es una conversación abierta hasta que se corrige o se responde y
  se resuelve.
- Checks de GitHub Actions requeridos y rama al día con la de destino. Hoy el
  único check requerido es `openspec-sync`; lint, tipos, pruebas, cobertura y
  escaneo de dependencias se añaden como requeridos cuando exista `ci.yml`.
- Aplicada también a administradores: nadie se la salta.

Cambiar la protección (quitar un check requerido, desactivar la resolución de
conversaciones) es decisión de una persona, se documenta y lleva fecha de
revisión.

## Verificación antes de fusionar

La protección impide fusionar si algo falla. **Solo el Orquestador fusiona**
(`gh pr merge <PR> --merge`, autorizado por el usuario el 2026-10-22), y solo
después de comprobar y dejar constancia de:

```bash
gh pr checks <PR>                       # todos en verde, ninguno pendiente
# Revisión de CodeRabbit más reciente sobre el HEAD actual: APPROVED o COMMENTED, nunca CHANGES_REQUESTED.
# Si devuelve null, CodeRabbit no ha revisado el último commit: pide la revisión
# (`gh pr comment <PR> --body "@coderabbitai review"`) y espera. Nunca se fusiona con null.
gh pr view <PR> --json headRefOid,reviews \
  --jq '(.headRefOid) as $head | [.reviews[] | select(.author.login=="coderabbitai" and .commit.oid==$head)] | max_by(.submittedAt) | if .state == "APPROVED" or .state == "COMMENTED" then .state else null end'
gh api graphql -f query='query($o:String!,$r:String!,$n:Int!){repository(owner:$o,name:$r){pullRequest(number:$n){reviewThreads(first:100){nodes{isResolved}}}}}' \
  -F o=lcasadov -F r=ChangeHouse -F n=<PR> \
  --jq '[.data.repository.pullRequest.reviewThreads.nodes[]|select(.isResolved==false)]|length'   # debe ser 0
```

> **Excepción temporal (2026-10-22, decisión del usuario):** hasta terminar el
> backlog de changes se integra con los checks de CI en verde sin esperar a
> CodeRabbit. Los hilos abiertos que bloqueen la integración se contestan
> enlazando el issue #212, donde se listan para revisarlos al final, y se
> resuelven.

Si algo no cumple, la PR **no se fusiona**: se corrige la causa. Nunca se usa
`--admin` para saltarse la protección. Los subagentes tienen prohibido fusionar.


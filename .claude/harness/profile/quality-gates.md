# Perfil de Habitinder — Puerta de calidad

> La puerta se compone de **checks de GitHub Actions** y de la revisión
> automática de **CodeRabbit**, ambos exigidos por la protección de rama.

## Componentes de la puerta

| Control | Herramienta | Bloquea |
|---|---|---|
| Lint y formato | `$LINT_CMD` en GitHub Actions | Check requerido |
| Comprobación de tipos | `$TYPECHECK_CMD` en GitHub Actions | Check requerido |
| Pruebas | `$TEST_CMD` en GitHub Actions | Check requerido |
| Cobertura sobre código nuevo | `$COVERAGE_CMD` con umbral configurado en la herramienta | Check requerido |
| Dependencias vulnerables | Escaneo de dependencias en la CI (severidad crítica) | Check requerido |
| Revisión automática | CodeRabbit (`coderabbitai[bot]`) | Hallazgos sin atender = PR no lista |
| Revisión humana | `$REVIEWER` | Aprobación requerida |

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

- Los checks deben estar marcados como **requeridos** en la protección de rama
  de `$BASE_BRANCH` y `$PROD_BRANCH`. Un check que no es requerido no bloquea:
  produce verdes falsos.
- El umbral de cobertura se configura **en la herramienta de pruebas** (por
  ejemplo, `coverage.thresholds` en Vitest), para que el propio comando falle.
- CodeRabbit debe estar instalado en el repositorio y su configuración
  (`.coderabbit.yaml`) debe cubrir `$BASE_BRANCH` y `$PROD_BRANCH` como ramas de
  destino. Con `request_changes_workflow: true` su revisión pide cambios y
  aprueba al resolverse. Lo que **bloquea** la fusión es la protección de rama
  con *Require conversation resolution before merging*: cada comentario de
  CodeRabbit queda como conversación abierta hasta que se corrige o se responde
  y se resuelve. La protección se aplica también a administradores.
- La puerta es **bloqueante** tanto en integración continua como en la Pull
  Request.

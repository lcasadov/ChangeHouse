# Perfil de Habitinder — Pipelines

Proveedor: **GitHub Actions**. Definiciones en `.github/workflows/`.

> Los workflows se escriben en el propio repositorio, reutilizando acciones
> publicadas y *reusable workflows* propios para no duplicar lógica.

## Reutilización

- Lógica común (instalar dependencias, cachés, autenticación con Google Cloud)
  en **acciones compuestas** de `.github/actions/<nombre>/action.yml` o en
  *reusable workflows* (`on: workflow_call`). Un workflow que copia pasos de
  otro acaba divergiendo en silencio.
- Las acciones de terceros se fijan, preferiblemente, por **SHA de commit** en
  lugar de etiqueta móvil (`@v4`), y se actualizan con Dependabot. Las
  acciones oficiales de GitHub (`actions/*`) pueden ir por etiqueta mayor.
- `permissions:` explícito y mínimo en cada workflow; el valor por defecto del
  `GITHUB_TOKEN` es más amplio de lo necesario.

## Workflows previstos

| Workflow | Disparador | Qué hace |
|---|---|---|
| Integración (`ci.yml`) | `pull_request` hacia `$BASE_BRANCH` y `$PROD_BRANCH`; `push` a ramas de trabajo | Instalación, lint, tipos, pruebas, cobertura con umbral, escaneo de dependencias |
| Coherencia de OpenSpec (`openspec-sync.yml`) | `pull_request` | `node .claude/hooks/openspec-sync-check.cjs --ci` |
| Despliegue (`deploy.yml`) | `push` a `$BASE_BRANCH` (DES) y promoción manual | Construye una vez, publica el artefacto y lo promociona por entornos |

Los nombres concretos los fija `$PIPELINE_DIR` cuando existan: antes de crear uno
nuevo, mira cómo se llaman los existentes y respétalo.

## Errores frecuentes

| Síntoma | Causa |
|---|---|
| La PR se puede fusionar con la CI en rojo | El check no está marcado como **requerido** en la protección de rama. No produce error: produce un verde falso |
| Cobertura sin umbral | El comando de cobertura genera el informe pero no falla por debajo de `$COVERAGE_THRESHOLD`. El umbral se configura en la herramienta de pruebas, no en un paso aparte que solo avisa |
| CodeRabbit no revisa | La app no está instalada en el repositorio, o la rama de destino no está en su configuración (`.coderabbit.yaml`) |
| El despliegue usa un artefacto que no es el verificado | Se compila de nuevo en el job de despliegue en lugar de consumir el artefacto publicado |
| GitVersion calcula una versión incorrecta | `actions/checkout` sin `fetch-depth: 0`: falta el historial |

## Promoción entre entornos

```
DES → PROD
```

- Cada entorno es un **GitHub Environment** con sus propios secretos y variables.
- **Un solo artefacto** recorre los dos entornos. No se recompila entre etapas:
  lo validado en `DES` debe ser lo mismo que llega a `PROD` (misma imagen por
  *digest*). No hay entorno de QA: la validación funcional se hace en `DES`.
- La diferencia entre entornos está **solo** en la configuración, nunca en el
  binario.
- El paso a producción requiere **aprobación manual**: *required reviewers* en
  el environment `PROD`.

## Secretos

- En ejecución, los valores sensibles se resuelven desde **Google Secret
  Manager**.
- La CI se autentica en Google Cloud con **Workload Identity Federation**
  (`google-github-actions/auth`), sin claves de cuenta de servicio en JSON.
- Lo que la CI necesite se guarda como **secreto del environment** de GitHub,
  nunca en el fichero de workflow, en variables de texto plano ni en el
  repositorio.

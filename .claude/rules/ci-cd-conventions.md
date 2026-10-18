---
paths:
  - ".github/workflows/**"
  - ".github/actions/**"
  - "infra/**"
  - "**/Dockerfile"
---

# Convenciones de CI/CD

Genéricas para cualquier proveedor. Los valores concretos —proveedor, rutas,
entornos, umbrales— viven en `docs/project.md`. Si falta una clave, **para y
pregunta**; no supongas la convención.

| Variable | Uso |
|---|---|
| `$CI_PROVIDER` | Proveedor de integración continua |
| `$PIPELINE_DIR` | Ruta de las definiciones de pipeline |
| `$ENVIRONMENTS` | Entornos y su orden de promoción |
| `$DEPLOY_TARGET` | Destino de despliegue |
| `$COVERAGE_THRESHOLD` | Umbral mínimo sobre código nuevo |
| `$QUALITY_GATE` | Puerta de calidad aplicada y criterio de bloqueo |
| `$BASE_BRANCH` / `$PROD_BRANCH` | Ramas de integración y de producción |

## Nomenclatura

Un nombre de pipeline debe decir **qué verifica** y **sobre qué componente**,
sin abrirlo. Sigue el patrón ya presente en `$PIPELINE_DIR`: antes de crear uno
nuevo, mira cómo se llaman los existentes y respétalo. Introducir un segundo
criterio de nombrado es peor que heredar uno imperfecto.

Separa siempre integración (construir y verificar) de despliegue (promocionar a
un entorno). Un pipeline que hace ambas cosas no se puede reejecutar sin riesgo.

## Ficheros de definición

- Viven en `$PIPELINE_DIR`.
- **Ningún secreto en el fichero**: ni cadenas de conexión, ni contraseñas, ni
  tokens, ni claves de API. Tampoco «temporalmente» ni en comentarios.
- Los secretos se referencian desde el almacén del proveedor o desde un gestor
  externo, y se marcan como secretos en su origen.
- Un valor que ya se ha escrito en un fichero versionado está comprometido
  aunque lo borres después: rótalo, no lo edites.

## Puertas obligatorias

Ninguna etapa de despliegue puede ejecutarse si alguna de estas falla:

| Puerta | Criterio |
|---|---|
| Pruebas | Todas en verde. Ninguna omitida ni marcada como ignorada para pasar |
| Cobertura | Igual o superior a `$COVERAGE_THRESHOLD` sobre el código nuevo |
| Análisis estático | `$QUALITY_GATE` en estado satisfactorio |

Las puertas **bloquean**: si solo avisan, no son puertas. Un umbral que se puede
ignorar no protege nada, y su presencia da una falsa sensación de control.

Si una puerta falla, se corrige la causa. Bajar el umbral o excluir el fichero
del análisis para desbloquear una entrega es una decisión de producto que toma
una persona, se documenta y lleva fecha de revisión.

## Disparadores

- La integración se dispara en las ramas de trabajo y en las propuestas de
  integración hacia `$BASE_BRANCH`.
- El despliegue al primer entorno de `$ENVIRONMENTS` se dispara al integrar en
  `$BASE_BRANCH`.
- La promoción a los entornos posteriores **exige aprobación humana explícita**.
  Ningún cambio llega a producción por el mero hecho de haberse fusionado.

## Versionado

Comprueba `$VERSIONING_TOOL` y `$VERSION_BUMP_KEYWORDS` antes de tocar mensajes
de commit, etiquetas o títulos que el pipeline interprete. Palabras habituales
como `feat` o `breaking` disparan incrementos de versión en muchas herramientas:
escribirlas por costumbre publica un artefacto con la versión equivocada.

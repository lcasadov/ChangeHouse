---
description: "01 · Genera docs/project.md a partir de la plantilla del contrato, inspeccionando el README, el código fuente o ambos. No inventa: marca lo deducido y lo desconocido."
argument-hint: "[contexto opcional]"
---

# 01 · Arranque del contrato del proyecto

Eres un **arquitecto de software senior** especializado en ingeniería inversa de
repositorios. Tu trabajo es producir `docs/project.md`, el fichero del que
dependen todos los agentes del catálogo.

## Regla que gobierna todo lo demás

**No inventes ni un solo valor.** Un valor inventado no falla: produce código
incorrecto en silencio durante meses. Un `⚠️ PENDIENTE` para al agente y provoca
una pregunta. Siempre prefiere lo segundo.

## Entradas

| Fuente | Uso |
|---|---|
| `docs/project.md` | Si ya existe, lo **completas**: normalmente ya contiene los valores del perfil del proyecto. **No toques los valores ya fijados**; rellena los `⚠️ PENDIENTE` |
| `.claude/harness/templates/project.template.md` | **Estructura obligatoria.** No alteres su índice ni el nombre de las variables |
| `.claude/harness/profile/` | Documentos del perfil aplicado: convenciones que los valores dan por supuestas |
| `README.md` | Intención declarada del proyecto |
| Código fuente | Evidencia real. **Prevalece sobre el README** cuando se contradicen |

Si `docs/project.md` no existe, créalo a partir de
`.claude/harness/templates/project.template.md` y vuelca en él los valores de
`.claude/harness/profile/project.partial.md`.

## Procedimiento

### Paso 1 — Inventario del repositorio

Antes de escribir nada, inspecciona y anota qué encuentras:

| Busca | Te dice |
|---|---|
| Ficheros de construcción y gestión de dependencias | Lenguaje, versión de runtime, framework, ORM, librerías de prueba |
| Definiciones de integración continua | `$CI_PROVIDER`, `$PIPELINE_DIR`, comandos reales de construcción y prueba, entornos |
| Estructura de directorios de primer y segundo nivel | `$ARCH_STYLE`, módulos, si hay cliente además de servidor |
| Migraciones o esquema de base de datos | `$MIGRATION_TOOL`, motor de persistencia |
| Configuración de análisis estático y cobertura | `$QG_PROVIDER`, `$COVERAGE_CMD`, umbrales ya configurados |
| Ficheros de contenedores e infraestructura como código | `$CONTAINER_RUNTIME`, `$IAC_TOOL`, `$DEPLOY_TARGET` |
| Ramas existentes y su nomenclatura | `$BASE_BRANCH`, `$PROD_BRANCH`, convención de ramas |
| `.gitmodules` | Si existe, el proyecto es **multirepo**: recomienda `update --topology multirepo` y, en la sección 1, propone como repositorios enlazados las rutas de los submódulos, como `⚠️ SUPUESTO` |
| Historial de mensajes de commit | `$COMMIT_CONVENTION` real, no la declarada |
| Especificaciones de API existentes | `$API_CONTRACT` |
| Configuración de autenticación y autorización | `$AUTH_MECHANISM`, indicios de `$ACCESS_SEGREGATION_MODEL` |

**Lee el código, no solo los nombres de fichero.** Que exista un directorio
llamado `domain` no significa que la arquitectura sea hexagonal: compruébalo
mirando si importa infraestructura.

### Paso 2 — Clasifica cada variable

Cada clave de la plantilla debe quedar en **uno** de estos cuatro estados.
Ninguna en blanco.

| Estado | Cuándo | Ejemplo |
|---|---|---|
| Valor | Evidencia directa e inequívoca en el repositorio o el perfil | `$COVERAGE_CMD` leído del fichero de construcción |
| `⚠️ SUPUESTO: <valor>` | Deducido por inferencia razonable, **sin confirmar** | Runtime deducido de la versión del framework |
| `⚠️ PENDIENTE` | No hay evidencia y no es deducible | `$NORMATIVA` casi nunca está en el código |
| `N/A` | No aplica, y es una decisión consciente | `$CONTAINER_RUNTIME` en un proyecto sin contenedores |

La diferencia entre valor y `⚠️ SUPUESTO` es la más importante del documento.
Ante la duda, marca supuesto: es reversible, un dato falso no.

### Paso 3 — Completa `docs/project.md`

- Respeta el índice de la plantilla, sección por sección.
- Rellena **también** las tablas en prosa (ramas, umbrales de calidad), no solo
  las variables sueltas.
- Al final, añade una sección `## Procedencia` con tres columnas: variable ·
  origen (`perfil` / `código: <ruta>` / `README` / `deducido`) · confianza.
- Si has fijado `$SRC_ROOT`, `$FRONTEND_ROOT`, `$PIPELINE_DIR` o
  `$OPENSPEC_PATH`, ajusta tú mismo los `paths` del frontmatter de `.claude/rules/*.md`
  a esas rutas (en Claude Code no hay CLI que los regenere) y enumera en el
  informe qué reglas has tocado.

### Paso 4 — Informe de cierre

Termina tu respuesta con:

1. **Recuento** por estado: valores firmes, supuestos, pendientes y N/A.
2. **Los cinco pendientes de mayor impacto**, ordenados por cuántos artefactos
   del catálogo quedan bloqueados sin ellos.
3. **Contradicciones detectadas** entre README y código, si las hay. No las
   resuelvas por tu cuenta: exponlas.

## Prohibiciones

- No inventes umbrales, normativas, roles ni entornos.
- No copies valores de ejemplo de la plantilla como si fueran reales.
- No amplíes ni reduzcas el conjunto de variables. Si el proyecto necesita una
  clave nueva, **propónla** y espera confirmación.
- No escribas en `docs/project.md` nada sobre visión de producto, mercado ni
  casos de uso: eso va en `docs/product.md` (prompt 03).

## Salida esperada

```
docs/project.md   ← creado o actualizado
```

Más el informe de cierre en el chat. Si quedan pendientes, indica al usuario que
ejecute el prompt **02 · Auditoría del contrato**.


---

Contexto adicional del usuario: $ARGUMENTS

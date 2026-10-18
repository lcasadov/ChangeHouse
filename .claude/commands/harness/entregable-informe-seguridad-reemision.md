---
description: "Entregable · Reemite el informe SAST y SCA de un sistema que ya tiene una verificación anterior, contrastando con datos si sus recomendaciones surtieron efecto."
argument-hint: "[contexto opcional]"
---

# Entregable · Informe SAST y SCA — reemisión

**Vuelve a emitir** el informe de análisis estático de código (SAST) y de composición de
software (SCA) de un proyecto que **ya tiene una verificación anterior**, acreditando el
estado actual y contrastando con datos si las acciones recomendadas surtieron efecto.

> **Si el proyecto no tiene informe previo**, usa `entregable-informe-seguridad-primera-emision`.
> Este prompt asume que existe un documento anterior con el que comparar.

Salida: `docs/entregables/{{SISTEMA}}-Informe-SAST-SCA.docx`, generado sobre la plantilla
`.claude/harness/profile/entregables/informe-seguridad-reemision.docx`, más las
evidencias en `docs/entregables/evidencias/<fecha>/`.

**Antes de empezar**, lee:

- `docs/project.md` — el contrato del proyecto: `$PROJECT_NAME`, `$PROJECT_DESCRIPTION`,
  `$LANGUAGE`, `$FRAMEWORK`, `$BUILD_TOOL`, `$QG_PROVIDER`, `$QUALITY_GATE`, `$CI_PROVIDER`,
  `$PIPELINE_DIR` y `$DEPLOY_TARGET`. Si falta un dato, para y pregunta.
- [Formato común de los entregables](../../harness/entregables-formato.md) — plantilla, marcadores,
  generación del Word y verificación. Es obligatorio.

## Objetivo

Genera una **nueva versión del informe de seguridad de código y dependencias**, con calidad de
entregable para cliente, que cubra dos verificaciones distintas y complementarias:

1. **SAST** — análisis estático del código propio.
2. **SCA** — análisis de composición: vulnerabilidades conocidas de las dependencias de terceros.

El objeto es doble: **acreditar el estado actual** y **comprobar con datos si las acciones
recomendadas en la verificación anterior cerraron efectivamente los hallazgos**, en lugar de
darlo por supuesto. El informe debe ser **verificable**: toda cifra procede de una herramienta
ejecutada, no de tu criterio ni de tu memoria.

## Regla número uno — no inventes vulnerabilidades

**Nunca escribas un identificador CVE que no proceda de una consulta real a una base de
avisos.** Un modelo que enumera CVE «de memoria» produce datos fabricados con apariencia
creíble, y eso invalida el entregable entero. Si no puedes ejecutar el escáner, dilo y para.

## Regla número dos — no heredes ni una cifra

Las cifras del informe anterior sirven **únicamente como término de comparación**. Todo el
inventario se vuelve a resolver y a consultar desde cero contra las bases de avisos, y todas
las métricas del análisis estático se vuelven a extraer de la herramienta.

Dilo expresamente en el capítulo de objeto: «las cifras que siguen no se heredan de aquel
informe». Un lector debe poder distinguir lo que se ha vuelto a medir de lo que se arrastra.

## Regla número tres — dos historias que no son la misma

Esta es la confusión característica de una reemisión, y debes mantenerla resuelta de
principio a fin del documento.

| Qué es | Legítimo | Dónde va |
|---|---|---|
| Contraste entre **dos informes emitidos**: estado acreditado anterior frente a estado acreditado actual | **Sí** | Capítulo propio de contraste |
| Narración de lo que el equipo **corrigió mientras redactaba este informe** | **No** | Control de versiones y elementos de trabajo |

Lo primero es el valor añadido de una reemisión. Lo segundo es un diario de trabajo que no
pertenece a un entregable, y produce apartados del tipo «Incidencias cerradas durante la
preparación de este informe» que **no debes escribir**, ni en el cuerpo ni en los anexos.

Consecuencias concretas:

- Si durante la preparación corriges algo, el informe describe **el estado resultante**, en
  presente, sin narrar la corrección.
- **Cada conclusión y cada recomendación debe sostenerse en un hecho comprobable hoy**, salvo
  las que pertenezcan explícitamente al capítulo de contraste.
- Incluye en el capítulo de objeto una frase que separe ambas cosas, para que nadie lea el
  capítulo de contraste como una crónica interna.
- **La excepción legítima**: si una medida que hoy sostiene un resultado es **inestable o
  impuesta** —una versión forzada por resolución, una exclusión, una configuración que depende
  de un tercero—, debe figurar **como hecho vigente** en el apartado que corresponda, no como
  corrección aplicada. Es información que un revisor necesita para juzgar cuánto dura el
  resultado.

## Fase 0 — Punto de partida y reconocimiento

### El informe anterior

Localízalo en `docs/entregables/` junto a sus evidencias y anota, sin usarlo todavía como dato:

- Fecha, versión y rama de la verificación anterior.
- Recuento de hallazgos por componente y por severidad.
- **Las recomendaciones que emitió, con su identificador.** Son la lista que tendrás que
  contrastar una por una.
- Las limitaciones que declaró, para comprobar si alguna se ha levantado.

Añade una entrada nueva al **histórico de versiones**, con su fecha, conservando las
anteriores.

### El sistema

- Lenguajes, marcos de trabajo y versiones de cada componente. **Anota los cambios de rama
  mayor respecto de la verificación anterior**: suelen explicar buena parte de la variación.
- Gestores de dependencias de cada componente: Maven, Gradle, npm, pnpm, NuGet, pip, Poetry,
  Go modules…
- **Tipo de empaquetado** y **ámbitos de dependencia**. Es decisivo para el triaje posterior.
- Dónde se ejecuta el artefacto en producción: servidor de aplicaciones, contenedor, servicio
  gestionado. Pregunta al usuario si no consta en `$DEPLOY_TARGET`; **no lo supongas**.
- Si existe control de dependencias en la integración continua. Si la verificación anterior lo
  recomendó, comprueba **si se implantó, en qué cadenas y con qué umbral**.

**Vigila el alcance antes de comparar.** Si esta vez analizas más —por ejemplo, incluyendo el
ámbito de prueba— o menos que la vez anterior, los recuentos no son directamente comparables.
Declara la diferencia de alcance en el mismo apartado donde publiques la comparación.

## Fase 1 — SAST

### Obtención de los datos

Este proyecto no tiene SonarCloud. `$QG_PROVIDER` (CodeRabbit) revisa las Pull Requests, pero
**no es un analizador SAST** ni produce métricas consolidadas: no lo presentes como tal. El
análisis estático de seguridad se obtiene de **GitHub code scanning** (CodeQL u otra
herramienta que publique resultados SARIF en el repositorio). No pidas al usuario que adjunte
informes: consulta los datos con `gh`, nunca con `curl`.

1. Comprueba qué está habilitado en el repositorio:
   `gh api repos/{owner}/{repo}/code-scanning/analyses --jq ".[0] | {tool: .tool.name, ref, created_at}"`.
   Si responde que code scanning no está habilitado, **para y dilo**: sin herramienta SAST
   ejecutada no hay Fase 1, y el informe debe declararlo como limitación, no rellenarlo con
   tu criterio.
2. Obtén para **cada** herramienta y rama analizada:
   - Herramienta y versión, *query suite* o conjunto de reglas aplicado (por ejemplo
     `security-extended`), y lenguajes cubiertos. Esta cifra da la medida real del rigor.
     **Comprueba si la configuración ha cambiado desde la verificación anterior**: un
     resultado mejor con un conjunto de reglas más laxo no es una mejora.
   - Alertas abiertas con regla, severidad, severidad de seguridad, fichero y línea:
     `gh api "repos/{owner}/{repo}/code-scanning/alerts?state=open" --paginate`.
   - Alertas de **secret scanning** abiertas, si está habilitado:
     `gh api "repos/{owner}/{repo}/secret-scanning/alerts?state=open" --paginate`.
   - Fecha y hora del último análisis, y rama y commit analizados.
3. Recoge además, como contexto y no como SAST, los hallazgos de seguridad que CodeRabbit haya
   dejado en las Pull Requests recientes y su estado (corregido, respondido o abierto).

Si code scanning no está disponible y el usuario aporta un informe SARIF exportado de otra
herramienta, úsalo declarando su origen.

**Sobre las incidencias resueltas.** Descárgalas si la herramienta las ofrece, porque forman
parte de la evidencia del análisis, pero **no construyas con ellas un apartado del informe**.
El documento publica lo que está abierto hoy, y la comparación con el estado anterior se hace
en el capítulo de contraste, con cifras agregadas.

### Comprobaciones que casi nadie hace y debes hacer

- **¿El análisis bloquea de verdad?** Busca en `$PIPELINE_DIR` si algún workflow falla con
  alertas abiertas y si la protección de rama exige el check de code scanning. Si no lo espera, el control es informativo, no una barrera. Mira también
  las políticas de la rama: puede que lo que bloquea sea la política y no la construcción, y
  esa distinción importa. Decláralo con precisión.
- **¿Qué rutas están excluidas?** Recoge las exclusiones de análisis, de cobertura y de
  detección de duplicados, y **compáralas con las de la verificación anterior**: una exclusión
  nueva puede explicar por sí sola la desaparición de hallazgos.
- Un resultado limpio significa «no hay patrones inseguros que la herramienta detecte», no
  «el sistema es seguro». Redáctalo así.

## Fase 2 — SCA

### Principio rector: analiza el árbol resuelto, no lo declarado

Analizar solo las dependencias declaradas es el error que arruina estos informes. En el caso
que originó este prompt, el inventario declarado dio **5 hallazgos** y el árbol transitivo
completo dio **132**. La mayor parte del riesgo vive en bibliotecas que nadie eligió.

### Por ecosistema

Para cada componente necesitas tres cosas: el **inventario resuelto** con versiones ya
aplicadas, el **árbol** que dice de qué dependencia directa cuelga cada artefacto, y **quién
fija cada versión**.

| Ecosistema | Inventario y árbol | Auditoría |
|---|---|---|
| Maven | `dependency:list` · `dependency:tree` · `help:effective-pom` | Consulta por coordenadas (ver más abajo) |
| Gradle | `dependencies --configuration runtimeClasspath` (y la de pruebas) | Consulta por coordenadas |
| npm / pnpm / Yarn | `npm ls --all --json` | `npm audit --json`, completo y con `--omit=dev` |
| NuGet | `dotnet list package --include-transitive --format json` | `dotnet list package --vulnerable --include-transitive` |
| pip / Poetry | `pip freeze` · `poetry show --tree` | `pip-audit --format json` |
| Go | `go list -m all` | `govulncheck -json ./...` |

Audita siempre el árbol completo **y** restringido a producción: la diferencia entre ambos
recuentos es lo que permite triar por exposición.

**En Windows, fija la codificación de la consola** antes de capturar JSON, o los caracteres no
ASCII se corrompen:

```powershell
$prev = [Console]::OutputEncoding
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$out = npm audit --json 2>$null | Out-String
[Console]::OutputEncoding = $prev
[System.IO.File]::WriteAllText("$env:TEMP\npm-audit.json", $out, (New-Object System.Text.UTF8Encoding $false))
```

#### npm: cuidado con el recuento

`npm audit` informa de «N vulnerabilidades» contando **paquetes afectados**, no avisos. Un
paquete puede acumular varios avisos y un aviso alcanzar a varios paquetes. Extrae los avisos
del array `via` y **usa siempre el recuento de avisos** cuando sumes con otros componentes o
cuando compares con el informe anterior, o publicarás una cifra inconsistente. Comprueba qué
criterio usó el informe previo antes de comparar.

#### pnpm: el gestor de este proyecto

Habitinder es un monorepo **pnpm** (`apps/*`, `services/*`, `packages/*`). Analiza cada
paquete del espacio de trabajo y el conjunto:

```powershell
pnpm -r ls --depth Infinity --json > deps-tree.json          # árbol resuelto completo
pnpm -r ls --depth Infinity --prod --json > deps-prod.json   # solo producción
pnpm audit --json > audit-full.json
pnpm audit --prod --json > audit-prod.json
pnpm why <paquete>                                           # de qué directa cuelga
```

- `pnpm-lock.yaml` es la fuente de verdad de las versiones resueltas: el informe cita su
  commit.
- **Quién fija cada versión.** Revisa `pnpm.overrides` en el `package.json` raíz y los
  rangos de cada `package.json`. Cada `override` es una versión impuesta: debe figurar en el
  informe como **hecho vigente** (ver la regla número dos) y es un seguimiento manual que
  ninguna actualización ordinaria cubre.
- **Distingue lo que llega a cada destino.** La app Expo se empaqueta para Android, iOS y
  web; la API viaja en un contenedor de Cloud Run; la landing es estática. Una dependencia de
  desarrollo (Vitest, ESLint, Metro, herramientas de compilación) no viaja en ninguno.
- Como en npm, `pnpm audit` puede contar paquetes afectados en lugar de avisos: usa siempre
  el recuento de **avisos** al sumar componentes.

### Consulta a la base de avisos

Contrasta cada coordenada contra una base real. Si dispones de una herramienta que consulte
la *GitHub Advisory Database* u *OSV.dev* por coordenadas, úsala: agregan el NVD y no exigen
descargas.

**Usa la misma fuente que la verificación anterior, o declara el cambio.** Dos bases distintas
dan recuentos distintos, y atribuir a la remediación lo que produjo el cambio de herramienta
es el error más fácil de cometer en una reemisión.

**Sobre OWASP Dependency-Check:** es viable y gratuito, pero necesita una réplica local del
NVD de varios gigabytes cuya primera sincronización, sin clave de API del NIST, tarda horas.
Justifica la elección en el informe en lugar de silenciarla.

### Validación del canal de consulta — hazlo siempre, y hazlo bien

**Un inventario que devuelve cero avisos es indistinguible de una consulta que no se
ejecutó.** Interroga la misma base con coordenadas de resultado conocido y publica el
resultado en un apartado propio.

Cómo elegir las coordenadas de control, que en una reemisión es donde más se falla:

- Usa coordenadas **ajenas al inventario analizado**, elegidas por tener avisos publicados
  conocidos. Sirven de control positivo: demuestran que la consulta devuelve resultados
  cuando los hay.
- **Nunca uses las versiones que el proyecto tenía en la verificación anterior.** Es la
  tentación evidente, porque son vulnerables y están a mano, y es un error grave: la tabla
  pasa a servir a dos propósitos —validar el instrumento y acreditar la remediación— y el
  lector concluye que esas vulnerabilidades son del sistema. Un control con treinta y cuatro
  avisos críticos junto al nombre del proyecto arruina el informe entero. La remediación se
  acredita en el capítulo de contraste, no aquí.
- Añade como control negativo **las versiones que el proyecto resuelve hoy**, que deben
  devolver cero.
- Incluye una columna de **procedencia** —ajena al inventario / resuelta por el proyecto— y
  **declara expresamente, en prosa, que los avisos de los controles externos no afectan al
  sistema**. No confíes en que se deduzca de la tabla.
- Comprueba la coherencia por guion: que toda coordenada de control externo devuelva al menos
  un aviso y toda coordenada en uso devuelva cero. Publica el recuento de coherencia.

## Fase 3 — Triaje por exposición

Publicar un recuento en bruto es alarmismo. Clasifica cada hallazgo por su exposición real.

| Comprobación | Qué revela |
|---|---|
| Componente aportado por la plataforma en ejecución (servidor embebido en ámbito `provided`, imagen base) | **No viaja en el artefacto**: sus vulnerabilidades afectan a la plataforma instalada, y se resuelven actualizándola, no el código |
| Ámbito de pruebas | No llega a producción |
| Herramientas de desarrollo del frontend | Ejecutor de pruebas, empaquetador, optimizadores: no se distribuyen al navegador |
| Origen transitivo común | Varias decenas de hallazgos suelen colgar de una sola dependencia directa |
| Uso funcional real | Un fallo en un algoritmo o una función que el sistema no utiliza tiene explotabilidad nula |

Cuando la severidad nominal y el riesgo efectivo se contradigan, **dilo expresamente**. En el
caso original, las dos críticas del frontend estaban en el ejecutor de pruebas mientras que la
de mayor exposición real —la única que llegaba al navegador— figuraba como «moderada».

Marca como estimación lo que sea estimación: sin análisis de alcanzabilidad, escribe
«la explotabilidad se estima baja, pendiente de confirmación», no «no es explotable».

**Si el inventario sale a cero, el triaje no desaparece: cambia de objeto.** En lugar de
clasificar hallazgos, acredita **por qué** no los hay —qué versiones resuelve el proyecto y de
dónde vienen— y deja constancia de cualquier resolución impuesta que sostenga ese cero. Y
distingue la causa: un cero obtenido por actualizar no es lo mismo que un cero obtenido por
reducir el alcance del análisis.

## Fase 4 — Contraste con la verificación anterior

Es el capítulo que justifica una reemisión. Construye una tabla con una fila por cada
recomendación del informe anterior:

| Acción recomendada en la verificación anterior | Estado | Efecto medido |
|---|---|---|
| … | Ejecutada / Ejecutada parcialmente / No ejecutada | Lo que muestran **los datos de este análisis**, no lo que estaba previsto |

Reglas para que el capítulo valga algo:

- **Verifica cada fila contra los datos nuevos.** «Ejecutada» significa que lo has comprobado
  en el árbol resuelto o en la configuración, no que alguien lo dijera.
- **Declara lo no ejecutado.** Una reemisión que solo enseña avances es propaganda; su valor
  está precisamente en identificar lo que sigue pendiente.
- Si una acción se ejecutó **más allá de lo previsto** —una rama mayor por encima de la
  recomendada—, dilo: cambia el perfil de riesgo aunque cierre los mismos avisos.
- Publica la **reducción agregada** —total de avisos y total de críticos— y, si el alcance
  cambió entre verificaciones, adviértelo en el mismo párrafo.
- Cierra con la advertencia que la comparación exige: **no es una medida de mejora del código
  propio, sino del envejecimiento de las dependencias.** Los avisos anteriores no se
  introdujeron escribiendo código, se acumularon por no actualizar, y el mismo mecanismo los
  reproducirá si el inventario deja de mantenerse. Por eso el control continuo importa más que
  la fotografía del informe.

## Fase 5 — Plan de remediación

Si además hay hallazgos abiertos, mantén el plan con la misma disciplina de siempre:

1. **Cómo se corrige cada caso según el origen de la versión.** Son tres: gestionada por el
   catálogo del marco (se corrige elevando el marco), declarada en el proyecto (se corrige
   cambiando la versión declarada) y sin gestionar (impuesta por una transitiva: exige
   sustituir la dependencia de origen o fijarla expresamente).
2. **Versión objetivo por componente.** Usa la versión correctora mínima **dentro de la rama
   mayor en uso**. Decirle a un proyecto que actualice a la siguiente versión mayor del marco
   no es accionable.
3. **Acciones agregadas**, con cuántos hallazgos cierra cada una.
4. **Orden recomendado**, priorizando por exposición real y no por severidad nominal.
5. **Relación completa en anexo**: todos los hallazgos por severidad —crítica, alta, media y
   baja—, cada uno con identificador, componente, versión afectada y versión que lo corrige.

Genera las tablas del anexo **con un guion, no a mano**: son cientos de filas y la
transcripción manual introduce errores. Conserva el guion y su salida como evidencia.

Reproduce el título de cada aviso **literalmente en su idioma original** y adviértelo: permite
localizarlo sin ambigüedad y evita errores de traducción.

**Si no hay hallazgos**, conserva igualmente los apartados del anexo por severidad, vacíos y
con una línea que aclare que cada severidad se consultó y no que se omitiera. Un anexo ausente
se lee como un anexo olvidado.

## Estructura del documento

La plantilla ya trae esta estructura montada, con el índice. Conserva la numeración.

**Preliminares** (sin numerar): `Ficha del documento` · `Histórico de versiones` —**con una
entrada por emisión y su fecha**, conservando las anteriores— · `Revisión y aprobación` ·
`Índice`.

```ficha
Título
Sistema
Organización
Tipo de prueba
Herramientas
Rama analizada
Fecha del informe
Criterio de decisión
Resultado del análisis estático
Resultado del análisis de composición
Clasificación
Revisión
```

```aprobacion
Autor
Revisor de seguridad
Revisor técnico
Aprobador
```

```indice
1. Objeto y antecedentes
2. Alcance
   2.1 Activos analizados
   2.2 Ámbito excluido del análisis
   2.3 Fuera del alcance de esta verificación
   2.4 Diferencias de alcance respecto de la verificación anterior
3. Herramientas utilizadas
   3.1 Herramienta de análisis estático
   3.2 Herramientas de análisis de composición
   3.3 Validación del canal de consulta
4. Metodología y criterios del análisis estático
   4.1 Perfiles de reglas aplicados
   4.2 Distribución de las reglas de seguridad por severidad
   4.3 Calificación de seguridad
   4.4 Puerta de calidad aplicada
5. Ejecución del análisis estático
   5.1 Datos del análisis
   5.2 Vigencia del análisis
   5.3 Parámetros del escáner
6. Resultados del análisis estático
   6.1 Cuadro de resultados
   6.2 Dimensión del código analizado
   6.3 Vulnerabilidades abiertas
   6.4 Puntos calientes de seguridad
7. Análisis de composición de software (SCA)
   7.1 Objeto y método
   7.2 Inventario analizado
   7.3 Resultado global
   7.4 Triaje por exposición
   7.5 Contraste con la verificación anterior
   7.6 Plan de remediación
   7.7 Limitaciones específicas del análisis de composición
8. Controles automáticos vigentes
   8.1 Análisis estático en la integración
   8.2 Análisis de composición en la entrega
9. Limitaciones del análisis
10. Conclusiones
11. Recomendaciones
Anexo A — Evidencias y reproducibilidad
   A.1 Evidencias del análisis estático
   A.2 Evidencias del análisis de composición
   A.3 Reproducibilidad
Anexo B — Condiciones de la puerta de calidad
Anexo C — Parámetros del escáner
Anexo D — Relación de vulnerabilidades de las dependencias
   D.1 Severidad crítica
   D.2 Severidad alta
   D.3 Severidad media o moderada
   D.4 Severidad baja
   D.5 Avisos sin severidad asignada
```

### Cómo redactar los capítulos clave

- **Capítulo 1.** Explica que son dos verificaciones distintas, resume la anterior, declara el doble objeto, dice que las cifras no se heredan de aquel informe y **separa expresamente el contraste entre informes emitidos del proceso interno de preparación**.
- **Capítulo 3.** Tabla que asocia cada herramienta a su análisis. Incluye **solo las herramientas efectivamente empleadas**; no conviertas el capítulo en un catálogo de opciones.
- **Capítulo 2.4.** Qué se analiza ahora que no se analizó entonces, o al revés. Sin este apartado, la comparación del capítulo 7.5 no se puede juzgar.
- **Capítulo 3.3.** Controles positivos ajenos al inventario y negativos con las versiones en uso, con columna de procedencia y el recuento de coherencia. Nunca con las versiones de la verificación anterior.
- **Capítulo 7.5.** Una fila por recomendación anterior, verificada contra los datos nuevos. Declara lo no ejecutado y cierra con la advertencia sobre el envejecimiento de las dependencias.
- **Capítulo 8.** Si un control no bloquea de verdad, dilo: un control informativo no es una barrera.
- **Capítulo 10.** Conclusiones numeradas, cada una defendiendo una afirmación. Deben sostener la tensión entre ambos resultados sin edulcorarla: el código propio puede estar impecable y el conjunto desplegado seguir siendo vulnerable. Y una de ellas debe decir que **la mejora es reversible y no se sostiene sola**.
- **Capítulo 11.** Recomendaciones con identificador `R-nn`, prioridad y motivo comprobable hoy.
- **Anexo D.** Generado por guion. Si una severidad no tiene avisos, el apartado se conserva con una línea que lo aclare.

**No hay ningún capítulo de incidencias cerradas durante la preparación.** El único capítulo
comparativo es el de contraste, y compara dos informes emitidos.

## Evidencias

Conserva sin modificar, en `docs/entregables/evidencias/<fecha de emisión>/`:

- Salida íntegra de cada escáner, en JSON.
- Inventario de dependencias y árbol resuelto.
- Salida de la validación del canal de consulta, con su recuento de coherencia.
- Tablas generadas para el anexo, y el guion que las genera.
- Informe exportado de la herramienta de análisis estático, si se descargó.

**Las evidencias de la verificación anterior se conservan aparte, con su fecha**, no se
mezclan con las nuevas. Y **no conserves cortes intermedios** generados durante esta
preparación: una evidencia fechada que no respalda nada del documento solo genera dudas.

El anexo A recoge un apartado de **reproducibilidad** con las órdenes exactas y las
restricciones de entorno detectadas. Si los guiones de la emisión anterior fallaban en algún
caso —por ejemplo, no reescribir el fichero de salida cuando el resultado es cero, dejando
pasar por vigente un inventario caducado—, corrígelos y decláralo entre las restricciones.

## Verificación específica

Además de la verificación común del [formato de los entregables](../../harness/entregables-formato.md):

- **Reconcilia los recuentos entre componentes antes de escribir el resumen**, y reconcilia
  también los del capítulo de contraste con los del informe anterior.
- Que las referencias cruzadas existan: en una reemisión se renumera casi siempre, así que
  repásalas todas.
- **El histórico de versiones debe admitir una fila por emisión.** Si el generador venía de una
  primera emisión, probablemente asuma una sola fila.
- Que todas las herramientas citadas se hayan usado realmente.
- **Que no quede ni una frase narrando el proceso de preparación**: «partía de», «se corrigió
  antes de emitir», «las cifras corresponden al estado ya corregido». Búscalas expresamente.
- Que toda recomendación se apoye en un hecho comprobable hoy, y no en un hallazgo ya cerrado.
- **No escribas el generador asumiendo que habrá hallazgos.** Un guion que calcula métricas
  derivadas —porcentajes, máximos, severidad predominante— revienta con el inventario a cero.
  Prueba el camino vacío.
- Si el índice crece y desborda una línea dejando una página vacía, degrada los rótulos de
  tabla que usen estilo de encabezado a texto en negrita.

Si una corrección que hagas durante la preparación toca código de producción, **va en su
propia rama y su propio elemento de trabajo**, separada del entregable.

## Cómo informar al usuario

Presenta primero **lo que cambia la decisión**, no el recuento. Distingue siempre entre lo
que has verificado y lo que has estimado, y declara los huecos en lugar de rellenarlos.


---

Contexto adicional del usuario: $ARGUMENTS

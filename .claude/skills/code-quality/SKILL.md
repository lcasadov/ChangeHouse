---
name: code-quality
description: "Reglas de calidad de código que se aplican MIENTRAS se escribe código de producción o de pruebas: padre transversal más un fichero por stack (<stack>.md del catálogo y <stack>.local.md del proyecto). Úsalo al implementar o refactorizar cualquier fichero de código y al cerrar el bucle de un hallazgo de revisión."
---
# Skill · Calidad de código

Traduce las reglas del analizador estático a **directivas que se aplican
mientras se escribe el código**, no después. El objetivo es que el código pase
el gate de calidad a la primera, sin ciclos de corrección.

> **Regla de oro para todos los agentes:** prioriza estas reglas sobre tu
> intuición. No marques una tarea como terminada hasta que el análisis esté en
> verde.

## Cómo se usa

Este fichero contiene las reglas **transversales**, que aplican a cualquier
lenguaje. Además, lee los **dos** ficheros del stack que estés tocando:

- `<stack>.md` — reglas generales del stack. Cámbialo solo de forma
  deliberada, no para resolver un caso concreto.
- `<stack>.local.md` — reglas que ha aprendido **este proyecto**. Aquí van las
  reglas nuevas.

El catálogo solo trae ficheros para los stacks que ya han pasado por él; **no
son una lista de tecnologías admitidas**. Cualquier lenguaje o framework vale:

| Stack con reglas en el catálogo | Fichero del catálogo |
|---|---|
| Java · Spring · Hibernate/JPA | [`java-spring.md`](java-spring.md) |
| TypeScript · JavaScript · React | [`typescript-react.md`](typescript-react.md) |

¿Tu stack no está en la tabla? Declárala igual al instalar
(`--stacks dotnet`, `--stacks python-django`…): la CLI crea `<stack>.local.md`
desde [`_template.md`](_template.md) para que el proyecto empiece a sembrar sus
reglas. El procedimiento completo —de dónde sacarlas, qué filtro aplicar y cómo
llevarlas al catálogo— está en la sección «Skills de calidad: crear y mantener»
del `AGENTS.md` del catálogo. Un stack sin reglas todavía no es un problema
inmediato: significa que, de momento, solo aplican las reglas transversales de
este documento.

## Qué **no** entra aquí

- **Los umbrales.** La cobertura mínima, el porcentaje de duplicación permitido y
  la definición del gate viven en `docs/TESTING-STRATEGY.md`. Este documento dice
  *cómo escribir*, no *cuánto exigir*.
- **La seguridad.** Inyección, secretos, XSS, CORS, cabeceras y todo lo que el
  analizador clasifica como *Vulnerability* o *Security Hotspot* es competencia
  del agente `Security` y de su checklist OWASP. Aquí no se duplica.

---

## Reglas transversales

Aplican a **todo lenguaje**. La mayoría de analizadores las implementan con
identificadores propios; el fichero de cada stack los concreta.

### Complejidad y tamaño

- **Complejidad cognitiva por función/método < 15.** Extrae funciones, usa
  *early returns*.
- **No anides control de flujo más de 3 niveles.**
- **Máximo 7 parámetros** por función. Si necesitas más, agrupa en una estructura
  con nombre.
- Funciones de ~30 líneas y unidades (clase, módulo) de ~200 como orden de
  magnitud. Al superarlo, extrae a un colaborador.

### Expresiones y valores

- **Nada de literales mágicos** en lógica de negocio: define constantes con
  nombre descriptivo para límites, tiempos de espera, factores e identificadores
  de estado. Excepción: `0`, `1` y `-1` en contexto obvio.
- **Literales repetidos → constante.** Aplica también dentro de literales de
  array y de argumentos variables. El analizador cuenta **todas** las ocurrencias
  del valor, no solo las que no usan la constante: si la constante ya existe,
  úsala en todas partes o la regla seguirá disparándose.
- **No anides expresiones ternarias.** Extrae la interna a una variable o
  reescribe como condicional con salida temprana.
- Compara por **valor**, no por referencia. Usa el operador de igualdad estricta
  del lenguaje.
- Usa la consulta de vacío propia del tipo (`isEmpty`, `is_empty`, …) en lugar de
  comparar la longitud con cero.

### Errores y recursos

- **Nunca captures sin actuar.** Ni bloques vacíos, ni excepciones ignoradas.
- **No lances ni captures los tipos más genéricos** del lenguaje. Usa tipos
  específicos que digan qué ha fallado.
- **Cierra siempre los recursos** con el mecanismo automático del lenguaje, nunca
  con una liberación manual en el bloque final.
- **Nada de escritura a consola** para diagnóstico: usa el registro estructurado
  del proyecto e incluye el contexto y la causa.

### Código muerto y obsoleto

- Sin importaciones, variables ni parámetros sin usar.
- **Nunca invoques API marcada como obsoleta.** Si la documentación indica el
  reemplazo, usa el reemplazo directamente.
- Al marcar algo como obsoleto, indica **cuándo se eliminará**. Lo obsoleto sin
  fecha de retirada nunca se retira.

### Duplicación

- No copies bloques: extrae función, utilidad o constante compartida.
- En pruebas se tolera cierto andamiaje repetido, pero si un bloque idéntico
  aparece en tres o más pruebas, extrae la preparación común.

---

## Reglas transversales para el código de prueba

El analizador también examina las pruebas, y ahí se concentran los defectos que
nadie mira.

- **Toda prueba debe tener al menos una aserción.** Una prueba sin aserciones
  está siempre en verde, incluso con el código roto. Es peor que no tenerla:
  cuenta como cobertura.
- **Nunca esperes con una pausa fija.** Usa el mecanismo de espera activa con
  condición y tiempo límite. Una pausa fija es lenta cuando sobra y frágil cuando
  falta.
- **No uses el reloj del sistema.** Si la fecha influye en el resultado, inyecta
  un reloj fijo. Si no influye, la regla admite supresión justificada.
- **Especifica siempre la zona horaria** al obtener la fecha u hora actual en
  código de producción. Omitirla hace que el resultado dependa de la máquina.
- **No simules lo que no controlas** —servicios de terceros, el reloj, el sistema
  de ficheros—: interponlo tras una abstracción propia y simula esa.
- Nombres de prueba descriptivos que expresen el comportamiento y la condición,
  no el nombre del método invocado.

---

## Proceso ante hallazgos

### Trampa habitual: extraer código «nuevo» de código antiguo

Al reducir la complejidad extrayendo una función, el analizador considera
**nuevas todas las líneas extraídas**, aunque el código existiera desde hace
años. Si esas líneas contenían literales repetidos o llamadas obsoletas, pasan a
contar como incumplimientos nuevos y **bloquean la entrega**.

**Regla:** al extraer, revisa las reglas de literales repetidos, API obsoleta y
credenciales aparentes sobre las líneas movidas, y corrígelas **en el mismo
cambio** que la extracción.

Es el motivo más frecuente de que una entrega pequeña se ponga en rojo sin que
nadie entienda por qué.

### Corrección

Corrige el hallazgo **antes** de solicitar la integración. Con el gate en rojo,
la integración está bloqueada.

### Supresión justificada

- La marca de supresión debe llevar **siempre una razón concreta**. Sin razón, se
  revierte en revisión.
- Debe estar en la **misma línea** que el código que suprime. En una línea
  anterior, la mayoría de analizadores la ignoran y el hallazgo persiste.
- **Nunca suprimas hallazgos de seguridad.** Los gestiona el agente `Security`
  mediante revisión explícita.

---

## Cómo se mantiene vivo este skill

Este documento crece con lo que el proyecto aprende fallando. Sin criterio, en
seis meses son cuatrocientas reglas que nadie lee. Por eso:
**Criterio de entrada.** Solo entra una regla que haya **bloqueado el gate al
menos dos veces**, o cuya corrección no sea evidente al leer el mensaje del
analizador. Lo que se deduce del propio aviso no se documenta.

**Criterio de salida.** Revisa el documento cada trimestre y **retira** las
reglas que lleven meses sin dispararse. Que una regla sea cierta no justifica que
ocupe la atención del lector.

**Momento de actualización.** Cuando el gate falla y la causa era evitable, la
regla se añade **en el mismo cambio que la corrección**. Nunca como tarea
diferida: no se hace.

**Dónde se añade.** En un proyecto, en `<stack>.local.md`. En el repositorio del
catálogo, en `<stack>.md`. Una regla local que demuestra valer para otros
proyectos se **promueve**: propuesta de integración en el catálogo que la lleva a
`<stack>.md` y, cuando se publica la versión, se borra del `.local.md`.

**Presupuesto.** Si un fichero de stack supera las ~150 líneas, algo sobra.
Prioriza por frecuencia real de incumplimiento.

**Formato fijo** para cada regla: qué hacer · por qué falla el gate · ejemplo
incorrecto · ejemplo correcto. Las reglas sin ejemplo se ignoran.

Si el proyecto tiene un servidor de análisis accesible mediante herramienta, la
fuente para alimentar este documento son los **hallazgos reincidentes** de los
últimos meses, no la lista completa de reglas del analizador.

El disparo operativo está en `.claude/rules/static-analysis.md`:
obliga a añadir la regla **en el mismo cambio que la corrección**. Sin ese
enganche, este documento envejece: nadie vuelve a él por iniciativa propia.

Si el proyecto usa OpenSpec, hay un segundo disparo, complementario y no
sustitutivo: `.claude/harness/openspec-extensions/quality-sync.md` revisa, antes de
implementar la primera tarea de una sesión, los hallazgos del último PR
fusionado, para que un error ya cometido no se repita en la sesión que arranca.
Uno mira hacia delante (lo que acabas de tocar); el otro, hacia atrás (lo último
que ya se integró).

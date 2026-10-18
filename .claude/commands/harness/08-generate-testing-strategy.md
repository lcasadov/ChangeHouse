---
description: "08 · Genera docs/TESTING-STRATEGY.md: pirámide de pruebas, umbrales de cobertura, política de dobles y criterios de aceptación verificables."
argument-hint: "[contexto opcional]"
---

# 08 · Estrategia de pruebas

Eres un **arquitecto de calidad senior** con experiencia en múltiples stacks.
Produces `docs/TESTING-STRATEGY.md`, el documento que **21 referencias** del
catálogo tratan como autoritativo.

## Paso 1 — Resumen previo, antes de escribir nada

Analiza `docs/project.md`, `$RBAC_MATRIX_DOC`, `docs/datamodel.md`,
`$API_CONTRACT` y las pruebas ya existentes, y devuelve primero un resumen de:

- Stack completo: lenguaje, framework, persistencia, cliente, integración
  continua, herramienta de análisis de calidad.
- Roles y **reglas críticas de negocio** del tipo «el rol X no puede hacer Y».
- `$NORMATIVA` aplicable y los requisitos que impone: retención de registros,
  doble aprobación, consentimiento, anonimización.
- Reglas de implementación verificables: fronteras entre capas, formato de
  respuesta, patrón de excepciones, auditoría.
- Módulos y flujos críticos de negocio.
- Estado actual: qué se prueba hoy y qué no.

Termina el resumen con las **preguntas abiertas**: volumetría, concurrencia
esperada, entornos disponibles para pruebas, disponibilidad de datos realistas.
**No continúes hasta tenerlas resueltas o marcadas como pendientes.**

## Paso 2 — El documento

### 1 · Pirámide de pruebas
Los niveles que aplica este proyecto, con proporción orientativa. Muchas rápidas
abajo, pocas y críticas arriba. Por cada nivel: qué valida, qué sustituye por un
doble y **cuánto puede tardar**. Un nivel sin presupuesto de tiempo acaba
saltándose.

### 2 · Política de dobles de prueba
La sección que más errores previene.

- La lógica de negocio se prueba **aislada**, sustituyendo el puerto o interfaz
  de salida, no la tecnología que hay detrás.
- La persistencia se prueba contra el **motor real** que se usa en producción,
  levantado de forma efímera. Sustituir la base de datos por una alternativa
  ligera o en memoria valida un dialecto que **no es el de producción**: da
  verde y falla en despliegue.
- Los sistemas externos se sustituyen en las pruebas propias, y se verifican
  aparte con pruebas de contrato.

Declara explícitamente qué está **prohibido** en este proyecto.

### 3 · Umbrales y puerta de calidad
Recoge `$COVERAGE_THRESHOLD`, `$COVERAGE_SCOPE`, `$QG_PROVIDER`, `$QG_LEVEL` y
`$NEW_CODE_DEFINITION`. Explica la lectura correcta: el umbral sobre código
nuevo es **condición de entrada**, no un objetivo hacia el que tender.

Aclara que la cobertura es un indicador de **ausencia**, no de presencia:
detecta lo que no se ha probado, no garantiza que lo probado esté bien.

### 4 · Correspondencia requisito ↔ prueba
Cómo se garantiza que cada escenario de una especificación tiene al menos una
prueba que lo verifica, y cómo se nombran las pruebas para que esa relación sea
evidente sin leer el cuerpo.

### 5 · Datos de prueba
Origen, construcción y aislamiento entre pruebas. Si se usan datos derivados de
producción, cómo se anonimizan según `$NORMATIVA`.

### 6 · Pruebas de seguridad y de permisos
Cada regla crítica de `$RBAC_MATRIX_DOC` con su prueba correspondiente. Incluye
siempre el **caso negativo**: que el rol no autorizado recibe la denegación
esperada.

### 7 · Ejecución
Comandos reales (`$TEST_UNIT_CMD`, `$TEST_INTEGRATION_CMD`, `$TEST_E2E_CMD`,
`$COVERAGE_CMD`), qué se ejecuta en cada momento del ciclo, y qué hacer ante una
prueba intermitente: se corrige o se retira, nunca se reintenta a ciegas.

### 8 · Pruebas basadas en propiedades
Si `$PROPERTY_TESTING_LIB` está declarada, dónde aportan: cálculos, invariantes
de dominio, transformaciones reversibles.

## Reglas

- **No propongas herramientas que el proyecto no tiene** sin declararlo como
  recomendación separada y justificada.
- Todo umbral debe ser verificable automáticamente; si no, no es un umbral: es
  un deseo.
- No documentes la pirámide ideal: documenta la de **este** proyecto, con sus
  carencias declaradas.

## Salida

```
docs/TESTING-STRATEGY.md
```


---

Contexto adicional del usuario: $ARGUMENTS

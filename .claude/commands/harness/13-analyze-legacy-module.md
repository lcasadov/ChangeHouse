---
description: "13 · Analiza un módulo heredado antes de migrarlo y produce docs/modules-analysis/<módulo>.md. Requisito obligatorio de la regla 7."
argument-hint: "[contexto opcional]"
---

# 13 · Análisis de módulo heredado

Eres un **ingeniero senior especializado en sistemas heredados**. Produces
`docs/modules-analysis/<módulo>.md`.

La regla 7 del catálogo es explícita: **ningún módulo de `$LEGACY_MODULES` se
migra sin este análisis previo.** Sin él, la migración reproduce defectos que
nadie sabía que existían y pierde comportamientos que alguien dependía.

## Pregunta al usuario, si no lo sabes

Qué módulo hay que analizar. **No elijas tú.**

## Procedimiento

### 1 · Perímetro
Qué entra y qué no. Ficheros, paquetes y tablas que pertenecen al módulo.

### 2 · Responsabilidad real
Qué hace el módulo **de verdad**, no lo que su nombre sugiere. Los módulos
heredados acumulan responsabilidades ajenas a su propósito original; encontrarlas
es el principal valor de este documento.

### 3 · Contrato de entrada
Quién lo invoca y por qué vía: interfaz de usuario, API, proceso programado,
mensajería, acceso directo a su base de datos. Cada consumidor identificado, con
su criticidad.

**Los consumidores desconocidos son el riesgo número uno de una migración.**
Si no puedes descartar que existan, dilo explícitamente.

### 4 · Contrato de salida
De qué depende: otros módulos, sistemas externos, ficheros, tablas compartidas.

### 5 · Reglas de negocio embebidas
El núcleo del análisis. Cada regla que el código implementa, expresada en
lenguaje de negocio, con su ubicación exacta.

Presta atención especial a:

- Condiciones sobre casos particulares, que suelen codificar excepciones reales
  del negocio que nadie documentó.
- Valores fijos en el código: fechas de corte, límites, códigos.
- Comportamientos ante error que el consumidor pueda estar aprovechando.
- Efectos secundarios: qué más ocurre además de lo evidente.

**Un comportamiento raro no es necesariamente un defecto.** Puede ser un
requisito real. Recógelo, marca la duda y **pregunta**; no lo elimines por
iniciativa propia.

### 6 · Datos
Tablas propias, compartidas, volumen y antigüedad. Si otros escriben en sus
tablas, la migración necesita una fase de convivencia.

### 7 · Estado de las pruebas
Qué hay hoy. Si no hay ninguna —lo habitual—, dilo con claridad: significa que
**antes de migrar hay que fijar el comportamiento actual con pruebas de
caracterización**, que documentan lo que el sistema hace, no lo que debería
hacer.

### 8 · Riesgos
Por cada uno: qué puede salir mal, probabilidad, impacto y cómo detectarlo
pronto.

### 9 · Estrategia propuesta
Migración incremental por envoltura y sustitución progresiva, con el orden de
extracción, el adaptador de compatibilidad necesario en cada paso y el criterio
para retirar el código antiguo.

Descarta explícitamente la sustitución de golpe salvo que el módulo sea trivial
y sin consumidores externos.

## Reglas

- **No propongas código nuevo** en este documento. Es análisis, no diseño.
- No copies el código heredado a la propuesta: se reescribe con el modelo nuevo.
- Todo lo que no puedas verificar va en una sección de **incógnitas**, con quién
  puede resolverlas.

## Salida

```
docs/modules-analysis/<módulo>.md
```


---

Contexto adicional del usuario: $ARGUMENTS

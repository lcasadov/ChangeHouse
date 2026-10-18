---
description: "03 · Genera docs/product.md: visión, objetivo, análisis de mercado, funcionalidades y modelo de negocio. Documento para personas, no contrato para agentes."
argument-hint: "[contexto opcional]"
---

# 03 · Documento de producto

Eres un **Product Owner senior**. Produces `docs/product.md`: el **porqué** y el
**para quién** del sistema.

> **Frontera que no se cruza.** `docs/product.md` es para personas.
> `docs/project.md` es el contrato técnico que leen los agentes. **Nunca
> escribas visión, mercado ni casos de uso en `docs/project.md`**, ni valores
> técnicos aquí.

## Entradas

`README.md`, código fuente, `docs/project.md` si ya existe, y lo que aporte el
usuario. **Solo eso.** Si algo no está en las fuentes, no está en el documento.

## Índice a generar

### 1 · Descripción general
Qué es el sistema en un párrafo que entienda alguien ajeno al equipo.

### 2 · Objetivo y valor
- Problema que resuelve y a quién.
- Valor añadido: qué mejora frente a no tener nada.
- Ventajas competitivas: qué lo hace preferible a las alternativas.

### 3 · Análisis del contexto
Alternativas existentes, dentro y fuera de la organización, y por qué no bastan.
Si no tienes datos, **dilo explícitamente** en lugar de rellenar.

### 4 · Funcionalidades principales
Las que definen el producto, no la lista completa. Para cada una: qué hace y a
qué usuario sirve.

### 5 · Recorrido del usuario
El camino desde que el usuario llega hasta que obtiene el valor, por cada perfil
relevante. Diagrama en **Mermaid**.

### 6 · Modelo de negocio
**Lean Canvas** en Mermaid. Si el sistema es interno y no tiene modelo de
ingresos, sustitúyelo por: coste evitado, riesgo mitigado y unidad de valor.

### 7 · Fuera de alcance
Lo que el producto **no** hace. Esta sección evita más malentendidos que las seis
anteriores juntas.

## Reglas

- **No inventes cifras de mercado, competidores ni volúmenes.** Si necesitas un
  dato, pregunta; si no lo obtienes, escribe `⚠️ PENDIENTE`.
- Sin jerga técnica: aquí no se habla de frameworks ni de bases de datos.
- Los diagramas van en Mermaid, dentro de bloques de código.
- Si detectas que el README promete algo que el código no hace, **señálalo**; no
  documentes la promesa como si fuera real.

## Salida

```
docs/product.md
```

Termina listando las preguntas abiertas que impiden completar el documento.


---

Contexto adicional del usuario: $ARGUMENTS

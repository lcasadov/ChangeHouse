---
description: "04 · Documenta la arquitectura del sistema respetando el estilo declarado en $ARCH_STYLE, con diagramas Mermaid y análisis honesto del stack."
argument-hint: "[contexto opcional]"
---

# 04 · Arquitectura del sistema

Eres un **arquitecto de software senior**. Documentas `docs/architecture.md`: la
estructura real del sistema y las decisiones que la explican.

## Entradas

`docs/project.md` (autoritativo), `docs/product.md`, `README.md` y **el código
fuente**.

## Regla de oro

**Documentas la arquitectura que el proyecto declara en `$ARCH_STYLE`, no la que
tú prefieres.** Ninguna arquitectura es universalmente correcta:

| `$ARCH_STYLE` | Cuándo es la elección correcta |
|---|---|
| `hexagonal` | Lógica de negocio propia y sustancial que debe sobrevivir a la infraestructura |
| `layered` | Aplicación mayoritariamente de altas, bajas y consultas |
| `feature-based` | Funcionalidades autocontenidas con poco acoplamiento entre sí |

Si el proyecto es heterogéneo —negocio complejo en unos módulos y operaciones
simples en otros—, **documéntalo así**, indicando el estilo por módulo. Forzar
un único patrón sobre todo el sistema añade ceremonia donde no aporta y la
quita donde hace falta.

Si el código **contradice** a `$ARCH_STYLE`, no lo maquilles: descríbelo como
está y señala la desviación.

## Índice a generar

### 1 · Vista de contexto
El sistema, sus usuarios y los sistemas externos con los que habla. Mermaid.

### 2 · Vista de componentes
Módulos internos y sus dependencias. Mermaid. **Deriva las dependencias de los
imports reales**, no del organigrama de carpetas.

### 3 · Aplicación del estilo arquitectónico
Cómo se materializa `$ARCH_STYLE` en este proyecto: qué hay en cada capa o
segmento, y dónde está la frontera. Si es hexagonal, incluye un diagrama de
puertos y adaptadores y enumera los puertos existentes con su implementación.

### 4 · Separación de responsabilidades
La lista concreta de invariantes verificables. Por ejemplo: qué paquetes no
pueden importar qué. Deben poder comprobarse con una herramienta, no con
buena voluntad.

### 5 · Decisiones y alternativas
Por cada decisión relevante: qué se eligió, qué se descartó y **qué se pierde**
con lo elegido. Una decisión sin coste declarado no está analizada.

### 6 · Evaluación del stack
Ventajas, desventajas y riesgos del stack actual, incluidos ciclo de vida y
fechas de fin de soporte. Si recomiendas un cambio, cuantifica el coste de
migración; si no puedes, no lo recomiendes.

### 7 · Flujos críticos
Los dos o tres recorridos que más duele que fallen, extremo a extremo. Mermaid
de secuencia.

## Reglas

- Diagramas en **Mermaid**, dentro de bloques de código.
- Cada afirmación sobre el código debe poder rastrearse a un fichero concreto.
- No inventes componentes «que debería haber». Documenta lo que hay y abre una
  sección de **brechas** para lo que falta.

## Salida

```
docs/architecture.md
```

Actualiza también la sección de arquitectura de `docs/project.md` **solo** si
descubres que `$ARCH_STYLE` o la estructura de módulos declarada están mal.
Avisa antes.


---

Contexto adicional del usuario: $ARGUMENTS

---
description: "Implementa una funcionalidad de principio a fin siguiendo el ciclo del catálogo: rama, especificación, pruebas primero, implementación y puerta de calidad."
argument-hint: "[contexto opcional]"
---

# Implementar una funcionalidad

Aplica el ciclo completo del catálogo a un cambio concreto. No sustituye a los
agentes especialistas: los invoca o adopta su papel según la capa afectada.

## Antes de escribir una línea

1. Lee `docs/project.md`. Si una variable que necesitas está `⚠️ PENDIENTE`,
   **para y pregunta**. No supongas.
2. Confirma que existe el **elemento de trabajo** en `$TRACKER`. Si no existe,
   pídeselo al orquestador: es el único autorizado a crearlo.
3. Confirma que estás en la **rama correcta**, creada desde el origen que
   corresponde al tipo de cambio. Nunca trabajes sobre `$BASE_BRANCH` ni
   `$PROD_BRANCH`.
4. Lee la especificación del cambio en `$OPENSPEC_PATH/changes/<slug>/`:
   la propuesta, el diseño y el delta de spec de la capacidad afectada.

   Si el comportamiento que vas a implementar **no está especificado**, detente:
   hay que abrir o ampliar el change con el ciclo de propuesta de OpenSpec antes
   de escribir código. Implementar sin spec produce comportamiento que ninguna
   prueba verifica y que nadie podrá justificar después.

## Ciclo

### 1 · Pruebas primero
Escribe las pruebas que describen el comportamiento esperado, derivadas de los
`#### Scenario:` del delta de spec. Ejecútalas y **confirma que fallan**.

Cada escenario del spec debe quedar cubierto por al menos una prueba. Una prueba
que pasa antes de existir el código no prueba nada.

### 2 · Implementación mínima
El código justo para que pasen. Nada que no esté cubierto por una prueba.

Respeta `$ARCH_STYLE`: no te saltes capas, no importes infraestructura desde el
dominio, no metas lógica de negocio en un adaptador.

### 3 · Refactorización
Mejora la estructura manteniendo las pruebas en verde.

### 4 · Verificación
Ejecuta las pruebas y la cobertura. El código nuevo debe cumplir
`$COVERAGE_THRESHOLD`; es **condición de entrada**, no un objetivo al que
aspirar.

## Innegociables

- **Las pruebas son el contrato.** Para que pasen se ajusta el código de
  producción, nunca la prueba. Está prohibido relajar una comprobación,
  comentarla o desactivarla.
- **No inventes contratos.** Ningún endpoint, campo, rol o estado que no esté en
  `$API_CONTRACT`, `docs/project.md` o la especificación del cambio.
- **Autorización en el servidor.** Lo que el cliente oculta es comodidad.
- **Sin secretos en el código**, en ninguna circunstancia.
- **Toda cadena visible al usuario** pasa por el mecanismo de `$I18N` si está
  activo, y todo estilo por los tokens de `$STYLE_GUIDE_DOC`.

## Al terminar

Informa de: ficheros modificados · pruebas añadidas y su resultado · comandos de
verificación ejecutados · estado de la puerta de calidad · deltas de
especificación · preguntas abiertas.

Marca las tareas completadas en `$OPENSPEC_PATH/changes/<slug>/tasks.md`
**solo** cuando la prueba existe, falló sin código y pasa con él.

Si el comportamiento implementado difiere de lo especificado, **actualiza el
delta de spec antes de dar el trabajo por terminado**. El código nunca puede ser
la única traza de una decisión.


---

Contexto adicional del usuario: $ARGUMENTS

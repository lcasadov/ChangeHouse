# Calidad de código · «nombre del stack»

> Plantilla. En un proyecto, cópiala como `<stack>.local.md`: es el fichero de
> reglas propio del proyecto. En el repositorio del catálogo, cópiala como
> `<stack>.md` y añade la fila correspondiente a la tabla de
> [`SKILL.md`](SKILL.md).

Complementa las reglas transversales de [`SKILL.md`](SKILL.md), que aplican
también aquí. Recoge **solo** lo específico de este stack: si una regla vale para
cualquier lenguaje, su sitio es el fichero padre.

## Criterio de admisión

Antes de añadir una regla, comprueba las tres condiciones:

1. Ha **bloqueado el gate al menos dos veces**, o su corrección no es evidente
   leyendo el mensaje del analizador.
2. Es **específica de este stack**. Si no, va al padre.
3. No es de **seguridad**. Esas las gestiona el agente `Security`.

## Formato de cada regla

Qué hacer · por qué falla el gate · ejemplo incorrecto · ejemplo correcto. Una
regla sin ejemplo se ignora en la práctica.

---

## Framework

<!-- Reglas del framework principal: inyección de dependencias, ciclo de vida,
     fronteras entre capas, manejo de errores. -->

## Acceso a datos

<!-- Carga de asociaciones, transacciones, identidad de las entidades,
     construcción de consultas. -->

## Lenguaje

<!-- Complejidad, nulos, gestión de recursos, API obsoleta, fechas y horas. -->

## Pruebas

<!-- Convenciones de nombres, espera de operaciones asíncronas, control del
     tiempo, política de dobles. -->

## Supresión

<!-- Sintaxis exacta de la marca de supresión en este lenguaje y dónde debe
     colocarse. Es el error más repetido: casi todos los analizadores exigen la
     misma línea, no la anterior. -->

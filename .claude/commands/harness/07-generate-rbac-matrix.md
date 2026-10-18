---
description: "07 · Genera la matriz de permisos en $RBAC_MATRIX_DOC: roles, recursos, operaciones y reglas contextuales, con criterio deny-by-default."
argument-hint: "[contexto opcional]"
---

# 07 · Matriz de permisos

Eres un **arquitecto de seguridad senior**. Produces `$RBAC_MATRIX_DOC`, la
referencia única de quién puede hacer qué. Sin ella, la regla 6 del catálogo no
puede verificarse.

## Entradas

`docs/project.md` (`$ACCESS_SEGREGATION_MODEL`, `$AUTH_MECHANISM`,
`$NORMATIVA`), `docs/product.md`, `$API_CONTRACT` y la configuración de
seguridad y anotaciones de autorización **del código**.

## Principio rector

**Denegación por defecto.** Lo que no está explícitamente permitido está
prohibido. Un hueco en la matriz no significa «permitido»: significa «sin
decidir», y por tanto denegado.

## Índice a generar

### 1 · Catálogo de roles
Por rol: nombre técnico, descripción de negocio en una frase, y a qué perfil de
persona corresponde. Indica si los roles son **acumulativos** o **exclusivos**;
esta decisión cambia por completo la evaluación de permisos.

### 2 · Matriz principal
Tabla de **recursos × roles**, con las operaciones permitidas por celda
(consultar, crear, modificar, eliminar y las específicas del dominio, como
aprobar o publicar). Celda vacía = denegado. Añade nota al pie si hay condición.

### 3 · Reglas contextuales
El permiso raramente depende solo del rol. Documenta las condiciones que además
lo restringen:

- Pertenencia: solo sobre los recursos de su unidad, centro o cartera.
- Autoría: solo sobre lo que ha creado.
- Estado: una operación permitida en borrador puede estar prohibida en aprobado.
- Segregación de funciones: quien solicita no puede aprobar. Si `$NORMATIVA` lo
  exige, es **obligatorio** y debe verificarse en servidor.
- Ventana temporal, si aplica.

### 4 · Reglas críticas
La lista de prohibiciones que **nunca** pueden ceder, redactadas de forma
verificable: «el rol X no puede hacer Y sobre Z». Cada una debe ser convertible
en una prueba automática. Esta sección alimenta directamente al agente de
pruebas.

Redacta la matriz de forma que pueda **consumirse como datos**, no solo leerse:
una fila por combinación de rol, recurso y operación, con el resultado esperado
explícito. Así una única prueba parametrizada recorre la matriz entera y falla
en la celda concreta que se ha violado. Una matriz que solo sirve para leerse
se desincroniza del código en semanas.

### 5 · Correspondencia con la API
Tabla que cruza cada operación de `$API_CONTRACT` con los roles autorizados.
**Toda operación debe aparecer.** Una operación sin fila en esta tabla es una
operación sin control de acceso decidido.

### 6 · Comportamiento ante denegación
Qué se devuelve al denegar y **qué se registra**. Distingue: no autenticado, sin
permiso, y sin permiso sobre un recurso cuya existencia no debe revelarse.

## Reglas

- **No inventes roles.** Si el código muestra roles que nadie ha documentado,
  recógelos y **pregunta** por su intención.
- Toda la autorización se evalúa en el servidor. Lo que el cliente oculta es
  comodidad, nunca control de acceso.
- Si el código y la matriz esperada difieren, documenta lo que **debe** ser y
  abre una sección de **desviaciones detectadas** con lo que hay.

## Salida

```
$RBAC_MATRIX_DOC
```


---

Contexto adicional del usuario: $ARGUMENTS

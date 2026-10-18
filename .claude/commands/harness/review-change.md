---
description: "Revisa un conjunto de cambios contra el contrato del proyecto, la especificación y los innegociables del catálogo. Solo informa; no corrige."
argument-hint: "[contexto opcional]"
---

# Revisar un cambio

Revisas los cambios pendientes de integrar contra las reglas del proyecto. **No
corriges**: informas, para que quien los escribió decida.

## Entradas

El conjunto de cambios respecto a `$BASE_BRANCH`, más `docs/project.md`,
`$API_CONTRACT`, `$RBAC_MATRIX_DOC`, `$CODE_STANDARDS_DOC`,
`$STYLE_GUIDE_DOC` y la especificación del cambio.

## Qué revisas, en este orden

### 1 · Corrección
¿Hace lo que dice la especificación? ¿Hay escenarios especificados sin cubrir?
¿Casos límite sin tratar: vacío, nulo, límites, concurrencia?

### 2 · Pruebas
- ¿Cada escenario de la especificación tiene al menos una prueba?
- ¿Hay **casos negativos**, o solo el camino feliz?
- ¿Alguna prueba se ha debilitado, comentado o desactivado? Es motivo de rechazo
  inmediato.
- ¿Se prueba la persistencia contra el motor real, según
  `docs/TESTING-STRATEGY.md`?
- ¿Cumple el código nuevo `$COVERAGE_THRESHOLD`?

### 3 · Seguridad
- ¿Se evalúa la autorización **en el servidor**, en todas las rutas nuevas?
- ¿Coincide con `$RBAC_MATRIX_DOC`? ¿Existe la prueba del caso denegado?
- ¿Entra algún dato del cliente en una decisión de permisos o de estado?
- ¿Secretos, credenciales o rutas absolutas en el código?
- ¿Registra o devuelve el sistema información sensible o trazas internas?

### 4 · Contrato
¿Aparece algún endpoint, campo, rol o estado que **no** esté en `$API_CONTRACT`?
Es una infracción de la regla 4, aunque funcione.

### 5 · Arquitectura
¿Se respeta `$ARCH_STYLE`? Busca en particular importaciones de infraestructura
desde el dominio, capas salteadas y lógica de negocio en adaptadores.

### 6 · Interfaz
Si hay cambios de interfaz: ¿tokens en vez de valores en crudo? ¿correcto en
**todos** los temas de `$THEMES`? ¿estados de carga, error y vacío?
¿accesibilidad según `$A11Y_LEVEL`? ¿textos internacionalizados?

### 7 · Convenciones
`$CODE_STANDARDS_DOC`. Y los mensajes de commit: comprueba que ninguno contiene
palabras que alteren la versión de forma no intencionada, según
`$VERSION_BUMP_KEYWORDS`.

## Formato del informe

```markdown
## Veredicto
<APTO | APTO CON REPAROS | NO APTO>

## Hallazgos
| Gravedad | Ubicación | Problema | Regla infringida |
|---|---|---|---|
| 🔴/🟠/🟡/🔵 | <fichero:línea> | <qué está mal y qué provoca> | <regla o documento> |

## Bloqueantes
- <lo que impide integrar, o "ninguno">

## Preguntas
- <duda que no puedes resolver leyendo el código>
```

## Reglas

- **No modifiques ficheros.**
- Nada de comentarios de estilo, formato o preferencia personal: si no lo exige
  un documento del proyecto, no es un hallazgo.
- Cada hallazgo cita **la regla concreta** que se infringe. Sin regla citada, es
  una opinión.
- Prioriza por daño real. Un problema de seguridad va antes que veinte de
  nomenclatura.


---

Contexto adicional del usuario: $ARGUMENTS

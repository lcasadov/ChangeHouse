# Perfil de ChangeHouse — Estrategia de ramas

Modelo: **GitFlow simplificado**, con dos ramas permanentes.

| Rama | Papel |
|---|---|
| `master` | Refleja **exactamente** lo que está en producción. Protegida |
| `develop` | Integración del trabajo en curso. Base del desarrollo diario. Protegida |

## Ramas temporales

| Tipo | Nace de | Se integra en | Para qué |
|---|---|---|---|
| `feature/<ID>-<slug>` | `develop` | `develop` | Funcionalidad nueva |
| `bugfix/<ID>-<slug>` | `develop` | `develop` | Defecto detectado antes de producción |
| `hotfix/<ID>-<slug>` | **`master`** | `master` **y** `develop` | Defecto **en producción** |
| `release/<versión>` | `develop` | `master` **y** `develop` | Estabilización previa a una entrega |

## Las dos reglas que más se incumplen

**Un `hotfix` nace de `master`, nunca de `develop`.** Si nace de `develop`,
arrastra a producción todo el trabajo aún no liberado. Es el error más caro de
este modelo porque no se manifiesta hasta el despliegue.

**Un `hotfix` y una `release` se integran en `master` *y* en `develop`.** Si
olvidas `develop`, la corrección desaparece en la siguiente entrega y el defecto
reaparece.

## Nomenclatura

```
<tipo>/<ID>-<slug>
```

- `<ID>`: identificador del elemento de trabajo. Entero, sin prefijo.
- `<slug>`: descripción corta en minúsculas separada por guiones.
- **Una rama por elemento de trabajo**, no una por persona o por agente. Varios
  agentes que colaboran en la misma historia comparten rama.

## Protección

Sobre `master` y `develop`:

- Prohibida la escritura directa.
- Integración solo mediante propuesta revisada.
- Integración continua en verde y puerta de calidad superada como condición.
- Al menos un revisor aprobando.

## Proyectos con repositorios enlazados

Aplica con la topología `multirepo` y `$LINKED_REPOS` distinto de `ninguno`: un
superrepositorio con submódulos que comparten rama. El detalle operativo está
en el skill `rama-espejo`.

| Regla | Detalle |
|---|---|
| **Nombre y origen** | Toda rama temporal existe con el mismo nombre en el superrepositorio y en cada repositorio enlazado. En **cada** repositorio, un `hotfix` nace de `master`; `feature`, `bugfix` y `release`, de `develop` |
| **Punteros** | En la rama espejo del superrepositorio, el gitlink de cada submódulo apunta a la punta de su rama espejo. Al integrar, a la revisión integrada en `develop` |
| **`.gitmodules`** | `branch = .` en cada submódulo, para que `git submodule update --remote` siga la rama homónima |
| **Integración** | Una propuesta por repositorio con commits, todas enlazadas al mismo elemento de trabajo |
| **`hotfix`** | Se integra en `master` **y** en `develop` de **cada** repositorio que haya cambiado. Comprueba la segunda integración repositorio a repositorio: si la sincronización automática queda bloqueada, el defecto reaparece en ese repositorio |
| **Ramas vacías** | Una rama espejo sin commits propios no genera propuesta y se borra al integrar |

## Advertencia conocida del modelo

En este modelo, los incrementos **Minor** acumulados en `develop` no se propagan
automáticamente a `master` a través de `release/*`: el artefacto de producción
puede quedarse subiendo solo el dígito **Patch**. Si necesitas que la versión de
producción refleje un incremento Minor, **fuérzalo de forma explícita** en la
rama de entrega. Ver `versioning.md`.

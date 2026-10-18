# Perfil de ChangeHouse — Versionado

Esquema: **SemVer** — `Major.Minor.Patch`.
Herramienta: **GitVersion**, mediante un fichero `GitVersion.yml` en la raíz del
repositorio, ejecutado en GitHub Actions con `gittools/actions` (requiere
`actions/checkout` con `fetch-depth: 0`).

| Dígito | Cuándo sube |
|---|---|
| `Major` | Cambio incompatible con la versión anterior |
| `Minor` | Funcionalidad nueva compatible hacia atrás |
| `Patch` | Corrección que no altera el contrato |

## Regla crítica: los mensajes de commit alteran la versión

GitVersion inspecciona los mensajes de commit y, si encuentra determinadas
palabras, **sobrescribe** el incremento configurado para la rama.

| Palabra en el mensaje | Efecto |
|---|---|
| `breaking`, `BREAKING CHANGE`, `increment major` | Incremento **Major** |
| `feat`, `increment minor` | Incremento **Minor** |

Esto ocurre **en cualquier rama**, incluidas `master` y `hotfix/*`.

### Consecuencia práctica

**No uses convenciones de commit con prefijo de tipo en este perfil.** Un
`feat(api): ...` rutinario provoca un incremento Minor no deseado. En una rama
de corrección urgente, altera la numeración de un artefacto de producción.

Convención de este perfil:

```
<descripción en imperativo> #<ID>
```

Ejemplo: `Añadir validación de vigencia en el alta de usuario #4821`

Las palabras disparadoras se usan **solo** cuando el incremento es intencionado
y está acordado.

## Inmutabilidad

Una versión publicada **no se modifica ni se reemplaza**. Si algo va mal, se
publica una versión nueva. Reemplazar un artefacto ya liberado rompe la
trazabilidad entre lo desplegado y lo auditado.

## Artefactos

El artefacto que se despliega es el que genera el **workflow de build** de
GitHub Actions: la imagen de contenedor publicada en Artifact Registry (API) o
el artefacto del workflow (web estática, binarios móviles de EAS). Es el único
origen válido para un despliegue: no se despliega desde una compilación local ni
desde un artefacto descargado a mano.

## Limitación conocida

Con GitFlow simplificado, los incrementos Minor acumulados en `develop` no se
propagan por sí solos a `master` a través de `release/*`. El artefacto de
producción tiende a subir solo el `Patch`. Cuando una entrega aporta
funcionalidad nueva, **fuerza el incremento Minor de forma explícita** y
verifica la versión resultante antes de publicar.

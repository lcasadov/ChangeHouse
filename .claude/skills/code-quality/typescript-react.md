# Calidad de código · TypeScript · JavaScript · React

Complementa las reglas transversales de [`SKILL.md`](SKILL.md), que aplican
también aquí. Los identificadores entre paréntesis son reglas de referencia de SonarQube/SonarLint;
en este proyecto el control lo ejercen ESLint (`$LINT_CMD`), TypeScript estricto y la revisión de
CodeRabbit en la PR, pero los criterios son los mismos.

## React

- Respeta las reglas de los hooks: siempre en el nivel superior, nunca dentro de
  condicionales ni bucles. Los hooks propios llevan el prefijo `use`.
- `useEffect`, `useMemo` y `useCallback` con el array de dependencias **completo
  y correcto**. No lo vacíes para silenciar al linter: es cómo se introducen los
  cierres obsoletos que nadie sabe depurar después.
- **Nunca uses el índice del array como `key`**; usa un identificador estable.
- Un componente, una responsabilidad. Extrae la lógica a hooks propios y evita el
  paso de propiedades a través de muchos niveles.
- **Limpia siempre los efectos**: suscripciones, temporizadores y escuchadores de
  eventos. Un efecto sin limpieza es una fuga.

## JavaScript / TypeScript

- **Complejidad cognitiva por función < 15** (S3776).
- `===` y `!==` siempre; nunca `==` ni `!=`. No anides ternarios (S3358).
- **Nunca `var`**: usa `const` o `let` (S3504). Prohibidos `eval()` y
  `new Function()` (S4524).
- Sin `console.log` en producción. Sin importaciones ni variables sin usar.
- **Ninguna promesa flotante**: toda promesa se espera con `await` dentro de
  `try/catch` o se encadena con `.catch()`. Una promesa rechazada sin gestionar
  no aparece en ningún sitio hasta que rompe algo lejano.
- En TypeScript, **evita `any`**: usa `unknown` y estrecha el tipo. Tipa las
  propiedades de los componentes y las respuestas de la API —que reflejan los
  DTOs del backend, nunca sus entidades—.

## Accesibilidad

- Todo elemento interactivo (`<button>`, `<a>`, `<input>`) debe tener texto
  accesible: contenido visible, `aria-label` o `title` (S6847).

## Pruebas

- Nombres que describan el comportamiento esperado, no el nombre de la función.
- **Nunca esperes con un temporizador fijo**: usa las utilidades de espera de la
  librería de pruebas, que reintentan hasta cumplir la condición o agotar el
  tiempo.
- **No uses el reloj del sistema**: si la fecha influye en el resultado, fija el
  tiempo con las utilidades de temporizadores simulados del ejecutor.
- Simula en la frontera de la red, no las funciones internas del módulo bajo
  prueba. Simular lo propio hace que la prueba verifique la simulación.

## Supresión

Solo con la directiva del linter que corresponda **a la línea concreta** y la razón en
un comentario justo encima. Nunca a nivel de fichero:

```ts
// Librería externa sin tipos; no modificable en este cambio
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const data = legacyLib.parse(raw) as any;
```

Si CodeRabbit marca la línea en la PR, responde al comentario con la misma razón
en lugar de resolverlo sin explicación.

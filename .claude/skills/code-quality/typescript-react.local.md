# Reglas locales · typescript-react

> Complementa a `typescript-react.md`, con las reglas generales del stack.
> **Este fichero es del proyecto**: aquí se anotan las reglas propias.

Aquí se anotan las reglas que este proyecto aprende cuando falla la puerta de
calidad, con el mismo criterio de admisión y el mismo formato que el fichero del
catálogo (ver `SKILL.md`, sección «Cómo se mantiene vivo este skill»).

Cuando una regla demuestre que vale para otros proyectos del mismo stack,
**llévala al catálogo** con una propuesta de integración en su repositorio que la
mueva a `typescript-react.md`, y bórrala de aquí cuando se publique la versión que la
incluye.

---

<!-- Primera regla local debajo de esta línea. -->

## Pruebas de propiedades (fast-check)

- **Las aserciones van dentro de la propiedad**, con `expect(...)`, no como un `return` booleano:
  `vitest/expect-expect` marca como «sin aserciones» un test que solo llama a `fc.assert(...)`, y
  un fallo con `expect` dentro muestra el valor concreto que rompe la propiedad.

```ts
fc.assert(
  fc.property(fc.boolean(), (hasHome) => {
    expect(deriveRole(null, hasHome)).toBe(hasHome ? 'owner' : 'seeker');
  }),
);
```

## Fastify

- Un plugin de rutas **sin `await`** se escribe como `FastifyPluginCallback` (`(app, _opts, done)`
  y `done()` al final), no como `async` vacío: `@typescript-eslint/require-await` marca el segundo.
- **Toda ruta lleva `config: { operationId }`** y su regla en `interfaces/http/authorization/policy.ts`
  más las filas de `test/authorization/rbac-matrix.json`; sin regla, la API la deniega (403).

## Expo y React Native

- **`process.env.EXPO_PUBLIC_*` es `any`**: `no-unsafe-assignment` lo marca. Se castea cada lectura
  (`process.env.EXPO_PUBLIC_X as string | undefined`) **sin** pasar por un alias ni por `process.env[name]`:
  Expo solo sustituye la expresión escrita tal cual al empaquetar.
- **Un grupo anunciado (`accessible` + `accessibilityRole="alert"`) nunca contiene controles**: en iOS
  los botones de dentro dejan de ser alcanzables. El mensaje va en su propio grupo y la acción al lado.
- **En las pruebas con RNTL 14, `render`, `renderHook` y `fireEvent` son asíncronos**: se esperan con
  `await`; un cambio de estado provocado desde fuera de ellos (un doble que emite) va dentro de `act`.
- **`Linking` ya es un `jest.fn` en el entorno de React Native**: `restoreAllMocks` no borra sus
  llamadas; usa `clearAllMocks` en `beforeEach` si cuentas llamadas.
- **Una ruta protegida (`Stack.Protected`) no redirige sola en el arranque**: queda «no encontrada».
  Hace falta `app/+not-found.tsx` que lleve a la pantalla de inicio que le toca a la sesión.

## Drizzle y PostGIS

- **`drizzle-kit generate` entrecomilla el tipo de una columna `customType`**: `"geography(Point,4326)"` no es un
  identificador y la migración falla al aplicarse. Se corrige a mano en el `.sql` (sin comillas) y se deja un
  comentario en la primera línea; la prueba de migración (`migrate.int.test.ts`) la aplica de verdad.
- **Las pruebas de `application/` no importan de `infrastructure/`** (`no-restricted-imports`, también en los
  `.test.ts`): los dobles de prueba viven en `test/fakes.ts`.

## Pruebas de integración con el despachador del outbox

- **Antes de vaciar tablas en `beforeEach`, se espera a que acabe el despacho en curso**: `await api.outbox.idle();`
  y solo después `TRUNCATE`. Las operaciones que registran un hecho (`likeHome`, `confirmMatch`,
  `withdrawFromMatch`, `sendMatchMessage`) lanzan el despachador sin esperarlo; si la prueba termina antes, su
  transacción retiene las filas de `outbox` mientras su manejador lee `matches`, y el `TRUNCATE` (que pide
  bloqueo exclusivo) deja a ese manejador esperando para siempre: la suite se cuelga sin ningún error.

```ts
// Incorrecto: el despacho lanzado por la prueba anterior puede seguir vivo
beforeEach(async () => {
  await sql`TRUNCATE matches, outbox, users CASCADE`;
});
// Correcto
beforeEach(async () => {
  await api.outbox.idle();
  await sql`TRUNCATE matches, outbox, users CASCADE`;
});
```

## React: efectos y llamadas opcionales

- **`react-hooks/set-state-in-effect`: no se llama a `setState` en el cuerpo del efecto para «resetear».** Se deriva
  el valor al renderizar (`return active ? (outcome?.query === text ? outcome : SEARCHING) : IDLE`) y el efecto solo
  guarda en el estado la respuesta asíncrona, dentro de su callback, con el texto al que responde.
- **`callback?.(await accion())` no ejecuta `accion` si `callback` es `undefined`**: el optional call corta también los
  argumentos. Se espera antes (`const resultado = await accion(); callback?.(resultado);`).

- **`react-hooks/refs`: un `useRef` no se pasa a un callback que se crea durante el render** (por ejemplo, dentro del
  inicializador de `useState`). El valor que cambia entre llamadas se guarda en una variable local de esa clausura
  (`let confirmed = saved;` dentro de `useState(() => { … })`), no en `ref.current`.

## Pruebas con React Native Testing Library

- **`getByRole` solo ve elementos `accessible`**: un grupo `radiogroup` que no lo es (para no agrupar a sus opciones en
  iOS) se consulta con `getByLabelText(...)` y se comprueba `props.accessibilityRole`.
- **`JSON.stringify(screen.toJSON())` falla con estructuras circulares** cuando hay proveedores de contexto en el árbol:
  se comprueba el estilo del elemento concreto (`styleOf(screen.getByTestId(...))`).
- **Un flujo completo de la app tarda más de 5 s en su primer test** (carga todos los módulos): el fichero declara
  `jest.setTimeout(30_000)`.
- **`Dialog` no expone `alertdialog` a `getByRole`**: se consulta por su título con `getByLabelText(título)`.
- **Un importe con `formatEuros` lleva espacio duro (U+00A0)**: en las pruebas se compara con `formatEuros(cents)`, no con un literal.
- **`AccessibilityInfo.isReduceMotionEnabled` también es un `jest.fn` de React Native**: tras un test que lo fija a `true`,
  `restoreAllMocks` no lo deshace y el valor se filtra a los siguientes del fichero. Los tests de animación fijan el valor
  que necesitan (`mockResolvedValue(false)`) en un `beforeEach`.

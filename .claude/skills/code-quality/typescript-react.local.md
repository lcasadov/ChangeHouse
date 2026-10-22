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

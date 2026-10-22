/**
 * Garantiza en compilación que un `switch` o cadena de `if` es exhaustivo;
 * si llega un valor en ejecución, falla con un mensaje diagnosticable.
 */
export function assertNever(value: never): never {
  throw new Error(`Valor inesperado: ${JSON.stringify(value)}`);
}

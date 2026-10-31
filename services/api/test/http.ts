import type { VerifiedIdentity } from '../src/application/auth/identity-verifier.js';
import type { Principal } from '../src/application/auth/principal.js';
import type { Role } from '../src/domain/account/role.js';

/** Captura las líneas de registro de pino para comprobar qué se escribe (y qué no). */
export function captureLogs() {
  const lines: string[] = [];
  return {
    lines,
    options: {
      level: 'info',
      stream: {
        write: (line: string) => {
          lines.push(line);
        },
      },
    },
    parsed: () => lines.map((line) => JSON.parse(line) as Record<string, unknown>),
    text: () => lines.join(''),
  };
}

export const IDENTITY: VerifiedIdentity = {
  uid: 'uid-1',
  email: 'ana@example.com',
  emailVerified: true,
};

/**
 * Principal de prueba: sin `role` es una identidad autenticada que aún no está dada de alta; con
 * `suspended`, una cuenta suspendida por un admin.
 */
export function principalOf(role?: Role, userId = 'user-1', suspended = false): Principal {
  return { identity: IDENTITY, account: role ? { userId, role, suspended } : null };
}

export type AccessMode = 'signIn' | 'signUp';

export type EmailProblem = 'emailRequired' | 'emailInvalid';
export type PasswordProblem = 'passwordRequired' | 'passwordTooShort';

/** Longitud mínima de la contraseña al registrarse (spec `accounts`). */
export const MIN_PASSWORD_LENGTH = 8;

// Comprobación de forma, no de existencia: la dirección real la confirma el enlace de verificación
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): EmailProblem | null {
  const trimmed = email.trim();
  if (trimmed === '') return 'emailRequired';
  return EMAIL_SHAPE.test(trimmed) ? null : 'emailInvalid';
}

/** Al entrar basta con que haya contraseña: la longitud solo se exige al crearla. */
export function validatePassword(password: string, mode: AccessMode): PasswordProblem | null {
  if (password === '') return 'passwordRequired';
  return mode === 'signUp' && password.length < MIN_PASSWORD_LENGTH ? 'passwordTooShort' : null;
}

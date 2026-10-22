import { useState } from 'react';

import { useServices } from '../session/services';
import {
  type AccessMode,
  type EmailProblem,
  type PasswordProblem,
  validateEmail,
  validatePassword,
} from './access-validation';
import { AuthError, type AuthErrorCode, type SocialSignIn } from './auth-service';

/** Qué operación está en curso: bloquea el resto y marca su botón como ocupado. */
export type Pending = 'email' | SocialSignIn['id'];

export type FormMessage =
  'invalidCredentials' | 'emailInUse' | 'tooManyRequests' | 'network' | 'unknown' | 'socialFailed';

export interface FieldProblems {
  email?: EmailProblem;
  password?: PasswordProblem;
}

const MESSAGES: Record<AuthErrorCode, FormMessage | null> = {
  'invalid-credentials': 'invalidCredentials',
  'email-in-use': 'emailInUse',
  'too-many-requests': 'tooManyRequests',
  network: 'network',
  unknown: 'unknown',
  // Estos dos se muestran junto a su campo, no como mensaje general
  'weak-password': null,
  'invalid-email': null,
};

function codeOf(error: unknown): AuthErrorCode {
  return error instanceof AuthError ? error.code : 'unknown';
}

/** Estado y acciones del formulario de acceso (registro o inicio de sesión) y de los proveedores externos. */
export function useAccessForm(mode: AccessMode) {
  const { auth, social } = useServices();
  const [email, setEmailValue] = useState('');
  const [password, setPasswordValue] = useState('');
  const [problems, setProblems] = useState<FieldProblems>({});
  const [message, setMessage] = useState<FormMessage | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);

  const clear = (field: keyof FieldProblems) => {
    setProblems((current) => ({ ...current, [field]: undefined }));
    setMessage(null);
  };

  const attempt = async (kind: Pending, action: () => Promise<void>) => {
    setPending(kind);
    setMessage(null);
    try {
      await action();
    } catch (error) {
      const code = codeOf(error);
      if (code === 'weak-password') setProblems({ password: 'passwordTooShort' });
      else if (code === 'invalid-email') setProblems({ email: 'emailInvalid' });
      else if (code === 'unknown' && kind !== 'email') setMessage('socialFailed');
      else setMessage(MESSAGES[code]);
    } finally {
      setPending(null);
    }
  };

  const submit = async () => {
    if (pending) return;
    const found: FieldProblems = {};
    const emailProblem = validateEmail(email);
    const passwordProblem = validatePassword(password, mode);
    if (emailProblem) found.email = emailProblem;
    if (passwordProblem) found.password = passwordProblem;
    setProblems(found);
    if (emailProblem || passwordProblem) return;

    const address = email.trim();
    await attempt('email', () =>
      mode === 'signUp'
        ? auth.signUpWithEmail(address, password)
        : auth.signInWithEmail(address, password),
    );
  };

  const signInWith = async (provider: SocialSignIn) => {
    if (pending) return;
    await attempt(provider.id, async () => {
      const credential = await provider.start();
      // Cancelar en el proveedor no es un error: la persona sigue en la pantalla de acceso
      if (credential) await auth.signInWithSocial(credential);
    });
  };

  return {
    social,
    email,
    password,
    problems,
    message,
    pending,
    changeEmail: (value: string) => {
      setEmailValue(value);
      if (problems.email) clear('email');
      else setMessage(null);
    },
    changePassword: (value: string) => {
      setPasswordValue(value);
      if (problems.password) clear('password');
      else setMessage(null);
    },
    blurEmail: () => {
      const problem = validateEmail(email);
      setProblems((current) => ({ ...current, email: problem ?? undefined }));
    },
    blurPassword: () => {
      const problem = validatePassword(password, mode);
      setProblems((current) => ({ ...current, password: problem ?? undefined }));
    },
    submit,
    signInWith,
  };
}

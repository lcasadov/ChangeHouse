import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { AuthError, type SocialCredential, type SocialSignIn } from './auth-service';

const CANCELED = 'ERR_REQUEST_CANCELED';

/**
 * Pide a Apple el token de identidad. Apple recibe el nonce cifrado y Firebase el nonce en claro, de
 * modo que un token robado no se puede reutilizar.
 */
export async function startAppleSignIn(): Promise<SocialCredential | null> {
  const rawNonce = Crypto.randomUUID();
  const nonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce,
    });
    if (!credential.identityToken) throw new AuthError('unknown');
    return { provider: 'apple', identityToken: credential.identityToken, rawNonce };
  } catch (error) {
    if (error instanceof AuthError) throw error;
    if ((error as { code?: unknown }).code === CANCELED) return null;
    throw new AuthError('unknown');
  }
}

/** Acceso con Apple: solo en iOS y solo si el dispositivo lo admite. */
export function useAppleSignIn(os: string = Platform.OS): SocialSignIn | null {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (os !== 'ios') return undefined;
    let current = true;
    AppleAuthentication.isAvailableAsync()
      .then((supported) => {
        if (current) setAvailable(supported);
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [os]);

  return useMemo(() => (available ? { id: 'apple', start: startAppleSignIn } : null), [available]);
}

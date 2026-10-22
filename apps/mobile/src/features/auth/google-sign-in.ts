import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useMemo } from 'react';
import { Platform } from 'react-native';

import { AuthError, type SocialCredential, type SocialSignIn } from './auth-service';

// En web, completa la ventana emergente de Google al volver a la app
WebBrowser.maybeCompleteAuthSession();

export interface GoogleEnv {
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?: string | undefined;
  EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?: string | undefined;
  EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?: string | undefined;
}

export interface GoogleConfig {
  webClientId: string | undefined;
  iosClientId: string | undefined;
  androidClientId: string | undefined;
}

/** El hook de Expo exige un identificador aunque Google no esté configurado: este no se usa nunca. */
const UNCONFIGURED_CLIENT_ID = 'google-not-configured';

const present = (value: string | undefined) => (value ? value : undefined);

export function readGoogleConfig(env: Readonly<GoogleEnv>): GoogleConfig {
  return {
    webClientId: present(env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID),
    iosClientId: present(env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID),
    androidClientId: present(env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID),
  };
}

/** Identificador de cliente de la plataforma actual; `undefined` si Google no está configurado en ella. */
export function googleClientIdFor(config: Readonly<GoogleConfig>, os: string): string | undefined {
  if (os === 'web') return config.webClientId;
  if (os === 'ios') return config.iosClientId;
  if (os === 'android') return config.androidClientId;
  return undefined;
}

/**
 * Acceso con Google (`expo-auth-session`). Devuelve `null` si la plataforma no tiene identificador de
 * cliente: entonces la interfaz no ofrece el botón.
 */
export function useGoogleSignIn(
  config: Readonly<GoogleConfig>,
  os: string = Platform.OS,
): SocialSignIn | null {
  const configured = googleClientIdFor(config, os) !== undefined;
  const [request, , promptAsync] = Google.useIdTokenAuthRequest({
    clientId: UNCONFIGURED_CLIENT_ID,
    webClientId: config.webClientId ?? UNCONFIGURED_CLIENT_ID,
    iosClientId: config.iosClientId ?? UNCONFIGURED_CLIENT_ID,
    androidClientId: config.androidClientId ?? UNCONFIGURED_CLIENT_ID,
  });

  const start = useCallback(async (): Promise<SocialCredential | null> => {
    if (!request) throw new AuthError('unknown');
    const result = await promptAsync();
    if (result.type === 'success') {
      const idToken = result.params['id_token'];
      if (!idToken) throw new AuthError('unknown');
      return { provider: 'google', idToken };
    }
    // Cerrar la ventana no es un error: la persona sigue en la pantalla de acceso
    if (result.type === 'error') throw new AuthError('unknown');
    return null;
  }, [request, promptAsync]);

  return useMemo(() => (configured ? { id: 'google', start } : null), [configured, start]);
}

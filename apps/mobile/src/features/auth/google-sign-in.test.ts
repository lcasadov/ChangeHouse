import { act, renderHook } from '@testing-library/react-native';
import * as Google from 'expo-auth-session/providers/google';

import { AuthError } from './auth-service';
import { googleClientIdFor, readGoogleConfig, useGoogleSignIn } from './google-sign-in';

jest.mock('expo-auth-session/providers/google', () => ({ useIdTokenAuthRequest: jest.fn() }));
jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn() }));

const useRequest = jest.mocked(Google.useIdTokenAuthRequest);

function mockPrompt(result: unknown, request: object | null = {}) {
  const promptAsync = jest.fn().mockResolvedValue(result);
  useRequest.mockReturnValue([request, null, promptAsync] as never);
  return promptAsync;
}

const env = {
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: 'web-id',
  EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: 'ios-id',
  EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID: 'android-id',
};

describe('readGoogleConfig / googleClientIdFor', () => {
  it('lee los identificadores de cliente y elige el de la plataforma', () => {
    const config = readGoogleConfig(env);

    expect(googleClientIdFor(config, 'web')).toBe('web-id');
    expect(googleClientIdFor(config, 'ios')).toBe('ios-id');
    expect(googleClientIdFor(config, 'android')).toBe('android-id');
  });

  it('una plataforma sin identificador (o vacío) no está configurada', () => {
    const config = readGoogleConfig({ EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: '' });

    expect(googleClientIdFor(config, 'ios')).toBeUndefined();
    expect(googleClientIdFor(config, 'web')).toBeUndefined();
    expect(googleClientIdFor(config, 'windows')).toBeUndefined();
  });
});

describe('useGoogleSignIn', () => {
  it('no ofrece Google si la plataforma no está configurada', async () => {
    mockPrompt({ type: 'success' });

    const { result } = await renderHook(() => useGoogleSignIn(readGoogleConfig({}), 'ios'));

    expect(result.current).toBeNull();
  });

  it('entrega el ID token de Google al completar el proveedor', async () => {
    mockPrompt({ type: 'success', params: { id_token: 'token-de-google' } });
    const { result } = await renderHook(() => useGoogleSignIn(readGoogleConfig(env), 'ios'));

    let credential;
    await act(async () => {
      credential = await result.current?.start();
    });

    expect(result.current?.id).toBe('google');
    expect(credential).toEqual({ provider: 'google', idToken: 'token-de-google' });
  });

  it.each(['cancel', 'dismiss', 'locked'])(
    'devuelve null si la persona abandona (%s)',
    async (type) => {
      mockPrompt({ type });
      const { result } = await renderHook(() => useGoogleSignIn(readGoogleConfig(env), 'web'));

      let credential;
      await act(async () => {
        credential = await result.current?.start();
      });

      expect(credential).toBeNull();
    },
  );

  it('si el proveedor falla o no devuelve token, lanza un error de autenticación', async () => {
    mockPrompt({ type: 'error' });
    const failing = await renderHook(() => useGoogleSignIn(readGoogleConfig(env), 'android'));
    await expect(failing.result.current?.start()).rejects.toBeInstanceOf(AuthError);

    mockPrompt({ type: 'success', params: {} });
    const withoutToken = await renderHook(() => useGoogleSignIn(readGoogleConfig(env), 'android'));
    await expect(withoutToken.result.current?.start()).rejects.toBeInstanceOf(AuthError);
  });

  it('si la petición aún no está lista, falla en lugar de abrir nada', async () => {
    const promptAsync = mockPrompt({ type: 'success' }, null);
    const { result } = await renderHook(() => useGoogleSignIn(readGoogleConfig(env), 'ios'));

    await expect(result.current?.start()).rejects.toBeInstanceOf(AuthError);
    expect(promptAsync).not.toHaveBeenCalled();
  });

  it('configura la petición con los identificadores de cliente', async () => {
    mockPrompt({ type: 'cancel' });

    await renderHook(() => useGoogleSignIn(readGoogleConfig(env), 'ios'));

    expect(useRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        iosClientId: 'ios-id',
        webClientId: 'web-id',
        androidClientId: 'android-id',
      }),
    );
  });

  it('con la plataforma sin configurar pasa identificadores de relleno para no romper el hook', async () => {
    mockPrompt({ type: 'cancel' });

    await renderHook(() => useGoogleSignIn(readGoogleConfig({}), 'ios'));

    const [config] = useRequest.mock.calls.at(-1) ?? [];
    expect(config?.clientId).toBeDefined();
  });
});

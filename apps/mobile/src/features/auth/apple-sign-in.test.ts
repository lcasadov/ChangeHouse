import { renderHook, waitFor } from '@testing-library/react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

import { startAppleSignIn, useAppleSignIn } from './apple-sign-in';
import { AuthError } from './auth-service';

jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn(),
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'nonce-en-claro'),
  digestStringAsync: jest.fn(() => Promise.resolve('nonce-con-hash')),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));

const apple = jest.mocked(AppleAuthentication);
const crypto = jest.mocked(Crypto);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('startAppleSignIn', () => {
  it('pide a Apple el token con el nonce cifrado y entrega el nonce en claro para Firebase', async () => {
    apple.signInAsync.mockResolvedValue({ identityToken: 'token-de-apple' } as never);

    const credential = await startAppleSignIn();

    expect(crypto.digestStringAsync).toHaveBeenCalledWith('SHA-256', 'nonce-en-claro');
    expect(apple.signInAsync).toHaveBeenCalledWith({
      requestedScopes: [0, 1],
      nonce: 'nonce-con-hash',
    });
    expect(credential).toEqual({
      provider: 'apple',
      identityToken: 'token-de-apple',
      rawNonce: 'nonce-en-claro',
    });
  });

  it('devuelve null si la persona cancela el cuadro de Apple', async () => {
    apple.signInAsync.mockRejectedValue(
      Object.assign(new Error('cancelado'), { code: 'ERR_REQUEST_CANCELED' }),
    );

    await expect(startAppleSignIn()).resolves.toBeNull();
  });

  it('cualquier otro fallo, o la ausencia de token, es un error de autenticación', async () => {
    apple.signInAsync.mockRejectedValueOnce(new Error('roto'));
    await expect(startAppleSignIn()).rejects.toBeInstanceOf(AuthError);

    apple.signInAsync.mockResolvedValueOnce({ identityToken: null } as never);
    await expect(startAppleSignIn()).rejects.toBeInstanceOf(AuthError);
  });
});

describe('useAppleSignIn', () => {
  it('se ofrece solo en iOS y cuando el dispositivo lo permite', async () => {
    apple.isAvailableAsync.mockResolvedValue(true);

    const { result } = await renderHook(() => useAppleSignIn('ios'));

    await waitFor(() => {
      expect(result.current?.id).toBe('apple');
    });
  });

  it('no se ofrece si el dispositivo no lo permite', async () => {
    apple.isAvailableAsync.mockResolvedValue(false);

    const { result } = await renderHook(() => useAppleSignIn('ios'));

    await waitFor(() => {
      expect(apple.isAvailableAsync).toHaveBeenCalled();
    });
    expect(result.current).toBeNull();
  });

  it('no se ofrece si la comprobación falla', async () => {
    apple.isAvailableAsync.mockRejectedValue(new Error('roto'));

    const { result } = await renderHook(() => useAppleSignIn('ios'));

    await waitFor(() => {
      expect(apple.isAvailableAsync).toHaveBeenCalled();
    });
    expect(result.current).toBeNull();
  });

  it.each(['android', 'web'])('no se ofrece en %s ni se consulta al sistema', async (os) => {
    const { result } = await renderHook(() => useAppleSignIn(os));

    expect(result.current).toBeNull();
    expect(apple.isAvailableAsync).not.toHaveBeenCalled();
  });
});

import { renderHook } from '@testing-library/react-native';

import { useAppleSignIn } from './apple-sign-in';
import type { SocialSignIn } from './auth-service';
import { useGoogleSignIn } from './google-sign-in';
import { useSocialSignIns } from './use-social-sign-ins';

jest.mock('./google-sign-in', () => ({
  ...jest.requireActual<object>('./google-sign-in'),
  useGoogleSignIn: jest.fn(),
}));
jest.mock('./apple-sign-in', () => ({ useAppleSignIn: jest.fn() }));

const google: SocialSignIn = { id: 'google', start: () => Promise.resolve(null) };
const apple: SocialSignIn = { id: 'apple', start: () => Promise.resolve(null) };

describe('useSocialSignIns', () => {
  it('ofrece solo los proveedores configurados, Google antes que Apple', async () => {
    jest.mocked(useGoogleSignIn).mockReturnValue(google);
    jest.mocked(useAppleSignIn).mockReturnValue(apple);
    const both = await renderHook(() => useSocialSignIns({}));
    expect(both.result.current).toEqual([google, apple]);

    jest.mocked(useGoogleSignIn).mockReturnValue(null);
    const onlyApple = await renderHook(() => useSocialSignIns({}));
    expect(onlyApple.result.current).toEqual([apple]);

    jest.mocked(useAppleSignIn).mockReturnValue(null);
    const none = await renderHook(() => useSocialSignIns({}));
    expect(none.result.current).toEqual([]);
  });

  it('pasa a Google los identificadores de cliente del entorno', async () => {
    jest.mocked(useGoogleSignIn).mockReturnValue(null);
    jest.mocked(useAppleSignIn).mockReturnValue(null);

    await renderHook(() => useSocialSignIns({ EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: 'ios-id' }));

    expect(useGoogleSignIn).toHaveBeenCalledWith({
      webClientId: undefined,
      iosClientId: 'ios-id',
      androidClientId: undefined,
    });
  });
});

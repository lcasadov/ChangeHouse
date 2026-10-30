import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import type { SocialSignIn } from '../auth/auth-service';
import { useSocialSignIns } from '../auth/use-social-sign-ins';
import { createAppServices } from './app-services';
import { AppSessionRoot } from './AppSessionRoot';
import type { AppServices } from './services';
import { SessionRoot } from './SessionRoot';

jest.mock('../auth/use-social-sign-ins', () => ({ useSocialSignIns: jest.fn() }));
jest.mock('./app-services', () => ({ createAppServices: jest.fn() }));
jest.mock('./SessionRoot', () => ({ SessionRoot: jest.fn() }));

const google: SocialSignIn = { id: 'google', start: () => Promise.resolve(null) };
const services = { legalUrls: { terms: 't', privacy: 'p' } } as AppServices;

describe('AppSessionRoot', () => {
  beforeEach(() => {
    jest.mocked(SessionRoot).mockImplementation(() => <Text>sesión</Text>);
    jest.mocked(createAppServices).mockReturnValue(services);
    jest.mocked(useSocialSignIns).mockReturnValue([google]);
  });

  it('monta la sesión con los servicios reales y los proveedores de este dispositivo', async () => {
    await render(<AppSessionRoot />);

    expect(screen.getByText('sesión')).toBeTruthy();
    expect(createAppServices).toHaveBeenCalledWith(expect.any(Object), [google]);
    expect(jest.mocked(SessionRoot).mock.calls[0]?.[0]).toEqual({ services });
  });

  it('lee de EXPO_PUBLIC_* la configuración de Firebase, de la API y de Google', async () => {
    await render(<AppSessionRoot />);

    const env = jest.mocked(createAppServices).mock.calls[0]?.[0];
    expect(Object.keys(env ?? {}).sort()).toEqual([
      'EXPO_PUBLIC_API_URL',
      'EXPO_PUBLIC_FIREBASE_API_KEY',
      'EXPO_PUBLIC_FIREBASE_APP_ID',
      'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
      'EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST',
      'EXPO_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST',
      'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
      'EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID',
      'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID',
      'EXPO_PUBLIC_GOOGLE_PLACES_KEY',
      'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
      'EXPO_PUBLIC_LEGAL_BASE_URL',
    ]);
  });
});

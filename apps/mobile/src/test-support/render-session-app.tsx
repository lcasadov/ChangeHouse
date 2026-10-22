import type { ThemeName } from '@changehouse/ui';
import { renderRouter } from 'expo-router/testing-library';

import AuthLayout from '../../app/(auth)/_layout';
import AccessRoute from '../../app/(auth)/access';
import ForgotPasswordRoute from '../../app/(auth)/forgot-password';
import WelcomeRoute from '../../app/(auth)/welcome';
import TabsLayout from '../../app/(tabs)/_layout';
import HomesRoute from '../../app/(tabs)/homes';
import ExploreRoute from '../../app/(tabs)/index';
import MatchesRoute from '../../app/(tabs)/matches';
import ProfileRoute from '../../app/(tabs)/profile';
import NotFoundRoute from '../../app/+not-found';
import OnboardingRoute from '../../app/onboarding';
import { createApiClient } from '../api/client';
import { createHttpAccountApi } from '../features/account/http-account-api';
import type { SocialSignIn } from '../features/auth/auth-service';
import type { AppServices } from '../features/session/services';
import { SessionRoot } from '../features/session/SessionRoot';
import { AppThemeProvider } from '../theme/AppThemeProvider';
import { authUser, FakeAuthService } from './fake-auth-service';
import { type FakeBackend, me } from './fake-backend';

export const TEST_LEGAL_URLS = {
  terms: 'https://changehouse.test/terminos',
  privacy: 'https://changehouse.test/privacidad',
} as const;

/** Servicios simulados mínimos: una persona con sesión, ya dada de alta. */
export function fakeServices(overrides: Partial<AppServices> = {}): AppServices {
  return {
    auth: new FakeAuthService({ initialUser: authUser() }),
    accountApi: { getMe: () => Promise.resolve(me()), upsertMe: () => Promise.resolve(me()) },
    social: [],
    legalUrls: TEST_LEGAL_URLS,
    ...overrides,
  };
}

export interface SessionAppOptions {
  auth: FakeAuthService;
  backend: FakeBackend;
  social?: readonly SocialSignIn[];
  theme?: ThemeName;
  /** Ruta a la que se abre la app (por defecto la raíz, que es una pestaña protegida). */
  url?: string;
}

/** La app completa (rutas reales, sesión y protección) con la autenticación y la API simuladas. */
export function renderSessionApp({
  auth,
  backend,
  social = [],
  theme = 'light',
  url = '/',
}: SessionAppOptions) {
  const accountApi = createHttpAccountApi(
    createApiClient({
      baseUrl: 'https://api.test',
      getToken: () => auth.getIdToken(),
      fetch: backend.fetch,
    }),
  );
  const services: AppServices = { auth, accountApi, social, legalUrls: TEST_LEGAL_URLS };

  function Root() {
    return (
      <AppThemeProvider override={theme}>
        <SessionRoot services={services} />
      </AppThemeProvider>
    );
  }

  return renderRouter(
    {
      _layout: Root,
      '(auth)/_layout': AuthLayout,
      '(auth)/welcome': WelcomeRoute,
      '(auth)/access': AccessRoute,
      '(auth)/forgot-password': ForgotPasswordRoute,
      onboarding: OnboardingRoute,
      '+not-found': NotFoundRoute,
      '(tabs)/_layout': TabsLayout,
      '(tabs)/index': ExploreRoute,
      '(tabs)/matches': MatchesRoute,
      '(tabs)/homes': HomesRoute,
      '(tabs)/profile': ProfileRoute,
    },
    { initialUrl: url },
  );
}

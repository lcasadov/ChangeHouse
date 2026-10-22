import type { ThemeName } from '@changehouse/ui';
import { renderRouter } from 'expo-router/testing-library';

import AuthLayout from '../../app/(auth)/_layout';
import AccessRoute from '../../app/(auth)/access';
import ForgotPasswordRoute from '../../app/(auth)/forgot-password';
import WelcomeRoute from '../../app/(auth)/welcome';
import TabsLayout from '../../app/(tabs)/_layout';
import AdminLayout from '../../app/(tabs)/admin/_layout';
import ModerationDetailRoute from '../../app/(tabs)/admin/[homeId]';
import AdminQueueRoute from '../../app/(tabs)/admin/index';
import HomesLayout from '../../app/(tabs)/homes/_layout';
import EditHomeRoute from '../../app/(tabs)/homes/[homeId]/edit';
import HomeDetailRoute from '../../app/(tabs)/homes/[homeId]/index';
import HomesRoute from '../../app/(tabs)/homes/index';
import NewHomeRoute from '../../app/(tabs)/homes/new';
import ExploreRoute from '../../app/(tabs)/index';
import MatchesRoute from '../../app/(tabs)/matches';
import ProfileRoute from '../../app/(tabs)/profile';
import NotFoundRoute from '../../app/+not-found';
import DiscoverDetailRoute from '../../app/discover/[homeId]';
import OnboardingRoute from '../../app/onboarding';
import { createApiClient } from '../api/client';
import { createHttpAccountApi } from '../features/account/http-account-api';
import { createHttpAdminApi } from '../features/admin/http-admin-api';
import type { SocialSignIn } from '../features/auth/auth-service';
import { createHttpDiscoveryApi } from '../features/discovery/http-discovery-api';
import type { AddressSuggestions } from '../features/homes/address-suggestions';
import { createFixtureAddressSuggestions } from '../features/homes/fixture-address-suggestions';
import { createHttpHomesApi } from '../features/homes/http-homes-api';
import type { PhotoPicker } from '../features/homes/photo-picker';
import type { PhotoUploader } from '../features/homes/photo-uploader';
import { createFixtureZoneSuggestions } from '../features/search/fixture-zone-suggestions';
import { createHttpSearchPreferencesApi } from '../features/search/http-search-preferences-api';
import type { ZoneSuggestions } from '../features/search/zone-suggestions';
import type { AppServices } from '../features/session/services';
import { SessionRoot } from '../features/session/SessionRoot';
import { AppThemeProvider } from '../theme/AppThemeProvider';
import { authUser, FakeAuthService } from './fake-auth-service';
import { DEFAULT_SEARCH_PREFERENCES, type FakeBackend, me } from './fake-backend';
import { FakePhotoPicker, FakePhotoUploader } from './fake-photos';

export const TEST_LEGAL_URLS = {
  terms: 'https://changehouse.test/terminos',
  privacy: 'https://changehouse.test/privacidad',
} as const;

/** Servicios simulados mínimos: una persona con sesión, ya dada de alta. */
export function fakeServices(overrides: Partial<AppServices> = {}): AppServices {
  return {
    auth: new FakeAuthService({ initialUser: authUser() }),
    accountApi: { getMe: () => Promise.resolve(me()), upsertMe: () => Promise.resolve(me()) },
    adminApi: {
      listPending: () => Promise.resolve({ items: [], nextCursor: null }),
      moderate: () => Promise.reject(new Error('Sin moderación en este doble')),
    },
    homesApi: {
      listMine: () => Promise.resolve([]),
      get: () => Promise.reject(new Error('Sin viviendas en este doble')),
      create: () => Promise.reject(new Error('Sin viviendas en este doble')),
      update: () => Promise.reject(new Error('Sin viviendas en este doble')),
      submit: () => Promise.reject(new Error('Sin viviendas en este doble')),
      createPhotoUpload: () => Promise.reject(new Error('Sin viviendas en este doble')),
      completePhotoUpload: () => Promise.reject(new Error('Sin viviendas en este doble')),
      deletePhoto: () => Promise.reject(new Error('Sin viviendas en este doble')),
    },
    discoveryApi: {
      list: () => Promise.resolve({ items: [], nextCursor: null }),
      getPublicHome: () => Promise.reject(new Error('Sin descubrimiento en este doble')),
      like: () => Promise.reject(new Error('Sin descubrimiento en este doble')),
      dismiss: () => Promise.reject(new Error('Sin descubrimiento en este doble')),
      undo: () => Promise.reject(new Error('Sin descubrimiento en este doble')),
    },
    photoPicker: { pick: () => Promise.resolve([]) },
    photoUploader: { upload: () => Promise.resolve() },
    searchPreferencesApi: {
      getMine: () => Promise.resolve(DEFAULT_SEARCH_PREFERENCES),
      putMine: () => Promise.reject(new Error('Sin preferencias en este doble')),
      getForHome: () => Promise.resolve(null),
      putForHome: () => Promise.reject(new Error('Sin preferencias en este doble')),
      deleteForHome: () => Promise.resolve(),
    },
    zoneSuggestions: createFixtureZoneSuggestions(),
    addressSuggestions: createFixtureAddressSuggestions(),
    social: [],
    legalUrls: TEST_LEGAL_URLS,
    ...overrides,
  };
}

export interface SessionAppOptions {
  auth: FakeAuthService;
  backend: FakeBackend;
  social?: readonly SocialSignIn[];
  /** Autocompletado de direcciones; por defecto, los lugares de prueba. */
  addressSuggestions?: AddressSuggestions;
  /** La galería del dispositivo; por defecto, una vacía. */
  photoPicker?: PhotoPicker;
  /** El envío a la URL firmada; por defecto, uno que deja el fichero en el backend simulado. */
  photoUploader?: PhotoUploader;
  /** Autocompletado de zonas de búsqueda; por defecto, los municipios y lugares de prueba. */
  zoneSuggestions?: ZoneSuggestions;
  theme?: ThemeName;
  /** Ruta a la que se abre la app (por defecto la raíz, que es una pestaña protegida). */
  url?: string;
}

/** La app completa (rutas reales, sesión y protección) con la autenticación y la API simuladas. */
export function renderSessionApp({
  auth,
  backend,
  social = [],
  addressSuggestions = createFixtureAddressSuggestions(),
  photoPicker = new FakePhotoPicker(),
  photoUploader = new FakePhotoUploader(backend),
  zoneSuggestions = createFixtureZoneSuggestions(),
  theme = 'light',
  url = '/',
}: SessionAppOptions) {
  const client = createApiClient({
    baseUrl: 'https://api.test',
    getToken: () => auth.getIdToken(),
    fetch: backend.fetch,
  });
  const services: AppServices = {
    auth,
    accountApi: createHttpAccountApi(client),
    homesApi: createHttpHomesApi(client),
    adminApi: createHttpAdminApi(client),
    addressSuggestions,
    photoPicker,
    photoUploader,
    discoveryApi: createHttpDiscoveryApi(client),
    searchPreferencesApi: createHttpSearchPreferencesApi(client),
    zoneSuggestions,
    social,
    legalUrls: TEST_LEGAL_URLS,
  };

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
      'discover/[homeId]': DiscoverDetailRoute,
      '+not-found': NotFoundRoute,
      '(tabs)/_layout': TabsLayout,
      '(tabs)/index': ExploreRoute,
      '(tabs)/matches': MatchesRoute,
      '(tabs)/homes/_layout': HomesLayout,
      '(tabs)/homes/index': HomesRoute,
      '(tabs)/homes/new': NewHomeRoute,
      '(tabs)/homes/[homeId]/index': HomeDetailRoute,
      '(tabs)/homes/[homeId]/edit': EditHomeRoute,
      '(tabs)/admin/_layout': AdminLayout,
      '(tabs)/admin/index': AdminQueueRoute,
      '(tabs)/admin/[homeId]': ModerationDetailRoute,
      '(tabs)/profile': ProfileRoute,
    },
    { initialUrl: url },
  );
}

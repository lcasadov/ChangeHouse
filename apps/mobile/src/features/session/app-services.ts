import { createApiClient } from '../../api/client';
import { createHttpAccountApi } from '../account/http-account-api';
import { createHttpAdminApi } from '../admin/http-admin-api';
import type { AuthService, SocialSignIn } from '../auth/auth-service';
import { createFirebaseAuth } from '../auth/create-firebase-auth';
import { createFirebaseAuthService } from '../auth/firebase-auth-service';
import { type FirebaseEnv, readFirebaseConfig } from '../auth/firebase-config';
import type { GoogleEnv } from '../auth/google-sign-in';
import {
  type AddressSuggestionsEnv,
  createAddressSuggestions,
} from '../homes/create-address-suggestions';
import { createHttpHomesApi } from '../homes/http-homes-api';
import { createExpoPhotoPicker } from '../homes/photo-picker';
import { createXhrPhotoUploader } from '../homes/xhr-photo-uploader';
import { createFixtureZoneSuggestions } from '../search/fixture-zone-suggestions';
import { createHttpSearchPreferencesApi } from '../search/http-search-preferences-api';
import type { AppServices } from './services';

export interface AppEnv extends FirebaseEnv, GoogleEnv, AddressSuggestionsEnv {
  /** Origen de la API, sin barra final (`services/api`). */
  EXPO_PUBLIC_API_URL?: string | undefined;
  /** Origen donde la landing publica `/terminos` y `/privacidad`. */
  EXPO_PUBLIC_LEGAL_BASE_URL?: string | undefined;
}

const DEFAULT_API_URL = 'http://localhost:8080/v1';
const DEFAULT_LEGAL_BASE_URL = 'http://localhost:4321'; // `astro dev`

const withoutTrailingSlash = (url: string) => url.replace(/\/+$/, '');

// Firebase solo admite una instancia por app: se crea la primera vez que hace falta y se reutiliza
let authService: AuthService | undefined;

/** Compone los servicios reales: Firebase Auth, el cliente HTTP tipado con el token y los textos legales. */
export function createAppServices(
  env: Readonly<AppEnv>,
  social: readonly SocialSignIn[],
): AppServices {
  authService ??= createFirebaseAuthService(createFirebaseAuth(readFirebaseConfig(env)));
  const auth = authService;
  const client = createApiClient({
    baseUrl: withoutTrailingSlash(env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL),
    getToken: () => auth.getIdToken(),
  });
  const legalBase = withoutTrailingSlash(env.EXPO_PUBLIC_LEGAL_BASE_URL || DEFAULT_LEGAL_BASE_URL);

  return {
    auth,
    accountApi: createHttpAccountApi(client),
    homesApi: createHttpHomesApi(client),
    adminApi: createHttpAdminApi(client),
    addressSuggestions: createAddressSuggestions(env),
    photoPicker: createExpoPhotoPicker(),
    photoUploader: createXhrPhotoUploader(),
    searchPreferencesApi: createHttpSearchPreferencesApi(client),
    // Sin servicio de zonas real todavía: las sugerencias de prueba (ver design.md de add-search-preferences)
    zoneSuggestions: createFixtureZoneSuggestions(),
    social,
    legalUrls: { terms: `${legalBase}/terminos`, privacy: `${legalBase}/privacidad` },
  };
}

export function resetAppServicesForTests(): void {
  authService = undefined;
}

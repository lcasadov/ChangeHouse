import { Platform } from 'react-native';

import { createApiClient } from '../../api/client';
import { createHttpAccountApi } from '../account/http-account-api';
import { createShareDataExporter } from '../account/share-data-exporter';
import { createWebDataExporter } from '../account/web-data-exporter';
import { createHttpAdminApi } from '../admin/http-admin-api';
import type { AuthService, SocialSignIn } from '../auth/auth-service';
import { createFirebaseAuth } from '../auth/create-firebase-auth';
import { createFirebaseAuthService } from '../auth/firebase-auth-service';
import { type FirebaseEnv, readFirebaseConfig } from '../auth/firebase-config';
import type { GoogleEnv } from '../auth/google-sign-in';
import {
  createFirestoreChatMessages,
  type FirestoreChatEnv,
} from '../chat/firestore-chat-messages';
import { createHttpChatApi } from '../chat/http-chat-api';
import { createHttpDiscoveryApi } from '../discovery/http-discovery-api';
import {
  type AddressSuggestionsEnv,
  createAddressSuggestions,
} from '../homes/create-address-suggestions';
import { createHttpHomesApi } from '../homes/http-homes-api';
import { createExpoPhotoPicker } from '../homes/photo-picker';
import { createXhrPhotoUploader } from '../homes/xhr-photo-uploader';
import { createHttpMatchesApi } from '../matches/http-matches-api';
import { createHttpModerationApi } from '../moderation/http-moderation-api';
import { createExpoPushNotifications } from '../notifications/expo-push-notifications';
import { createNoPushNotifications } from '../notifications/no-push-notifications';
import { createFixtureZoneSuggestions } from '../search/fixture-zone-suggestions';
import { createHttpSearchPreferencesApi } from '../search/http-search-preferences-api';
import { createAccountSuspensionSignal } from './account-suspension';
import type { AppServices } from './services';

export interface AppEnv extends FirebaseEnv, FirestoreChatEnv, GoogleEnv, AddressSuggestionsEnv {
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

/** Compone los servicios reales: Firebase (Auth y el chat en Firestore), el cliente HTTP tipado con el token y los textos legales. */
export function createAppServices(
  env: Readonly<AppEnv>,
  social: readonly SocialSignIn[],
): AppServices {
  authService ??= createFirebaseAuthService(createFirebaseAuth(readFirebaseConfig(env)));
  const auth = authService;
  const accountSuspension = createAccountSuspensionSignal();
  const client = createApiClient({
    baseUrl: withoutTrailingSlash(env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL),
    getToken: () => auth.getIdToken(),
    onAccountSuspended: () => {
      accountSuspension.notify();
    },
  });
  const legalBase = withoutTrailingSlash(env.EXPO_PUBLIC_LEGAL_BASE_URL || DEFAULT_LEGAL_BASE_URL);

  return {
    auth,
    accountApi: createHttpAccountApi(client),
    dataExporter: Platform.OS === 'web' ? createWebDataExporter() : createShareDataExporter(),
    homesApi: createHttpHomesApi(client),
    adminApi: createHttpAdminApi(client),
    moderationApi: createHttpModerationApi(client),
    addressSuggestions: createAddressSuggestions(env),
    photoPicker: createExpoPhotoPicker(),
    photoUploader: createXhrPhotoUploader(),
    discoveryApi: createHttpDiscoveryApi(client),
    matchesApi: createHttpMatchesApi(client),
    chatApi: createHttpChatApi(client),
    chatMessages: createFirestoreChatMessages(env),
    // En la web no hay push
    pushNotifications:
      Platform.OS === 'web' ? createNoPushNotifications() : createExpoPushNotifications(),
    searchPreferencesApi: createHttpSearchPreferencesApi(client),
    // Sin servicio de zonas real todavía: las sugerencias de prueba (ver design.md de add-search-preferences)
    zoneSuggestions: createFixtureZoneSuggestions(),
    social,
    legalUrls: { terms: `${legalBase}/terminos`, privacy: `${legalBase}/privacidad` },
    accountSuspension,
  };
}

export function resetAppServicesForTests(): void {
  authService = undefined;
}

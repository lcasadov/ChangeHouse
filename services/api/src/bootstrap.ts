import { PRIVACY_VERSION, TERMS_VERSION } from '@changehouse/shared';

import { accountOperations } from './application/account/account-operations.js';
import type { HomeOwnership } from './application/account/home-ownership.js';
import { resolvePrincipal } from './application/auth/resolve-principal.js';
import { homeOperations } from './application/home/home-operations.js';
import type { ImageProcessor } from './application/home/image-processor.js';
import { photoOperations } from './application/home/photo-operations.js';
import type { PhotoStorage } from './application/home/photo-storage.js';
import type { PlaceResolver } from './application/home/place-resolver.js';
import { moderationOperations } from './application/moderation/moderation-operations.js';
import { searchPreferencesOperations } from './application/search-preferences/search-preferences-operations.js';
import { joinWaitlist } from './application/waitlist/join-waitlist.js';
import type { ApiConfig } from './config.js';
import { createFirebaseIdentityVerifier } from './infrastructure/auth/firebase-identity-verifier.js';
import { AddressCipher } from './infrastructure/crypto/address-cipher.js';
import { SharpImageProcessor } from './infrastructure/images/sharp-image-processor.js';
import { createDatabase } from './infrastructure/persistence/drizzle/database.js';
import { DrizzleHomeOwnership } from './infrastructure/persistence/drizzle/drizzle-home-ownership.js';
import { DrizzleHomeRepository } from './infrastructure/persistence/drizzle/drizzle-home-repository.js';
import { DrizzlePhotoRepository } from './infrastructure/persistence/drizzle/drizzle-photo-repository.js';
import { DrizzleSearchPreferencesRepository } from './infrastructure/persistence/drizzle/drizzle-search-preferences-repository.js';
import { DrizzleUnitOfWork } from './infrastructure/persistence/drizzle/drizzle-unit-of-work.js';
import { DrizzleUserRepository } from './infrastructure/persistence/drizzle/drizzle-user-repository.js';
import { DrizzleWaitlistRepository } from './infrastructure/persistence/drizzle/drizzle-waitlist-repository.js';
import { FixturePlaceResolver } from './infrastructure/places/fixture-place-resolver.js';
import { GooglePlaceResolver } from './infrastructure/places/google-place-resolver.js';
import { CloudPhotoStorage } from './infrastructure/storage/cloud-photo-storage.js';
import { systemClock, uuidV7Generator } from './infrastructure/system.js';
import { buildApp } from './interfaces/http/app.js';

/** Adaptadores que se pueden sustituir al componer la API (las pruebas, y los changes que aún no los traen). */
export interface ApiAdapters {
  /** Por defecto, la consulta real a las viviendas (`DrizzleHomeOwnership`). */
  homeOwnership?: HomeOwnership;
  /** Por defecto, Google Places si hay clave de servidor y los lugares de prueba si no. */
  placeResolver?: PlaceResolver;
  /** Por defecto, Cloud Storage (o fake-gcs-server si hay `STORAGE_EMULATOR_HOST`). */
  photoStorage?: PhotoStorage;
  /** Por defecto, `sharp`. */
  imageProcessor?: ImageProcessor;
}

function placeResolverFor(config: ApiConfig): PlaceResolver {
  const apiKey = config.places.serverKey;
  return apiKey ? new GooglePlaceResolver({ apiKey }) : new FixturePlaceResolver();
}

/** Raíz de composición: une adaptadores, casos de uso y transporte. */
export function createApi(config: ApiConfig, adapters: ApiAdapters = {}) {
  const database = createDatabase(config.databaseUrl);
  const { verifier, close: closeIdentity } = createFirebaseIdentityVerifier(config.firebase);

  const users = new DrizzleUserRepository(database.db);
  const ownership = adapters.homeOwnership ?? new DrizzleHomeOwnership(database.db);
  const cipher = AddressCipher.fromBase64(config.addressEncryptionKey);
  const waitlistDeps = {
    repository: new DrizzleWaitlistRepository(database.db),
    clock: systemClock,
    ids: uuidV7Generator,
  };
  const accounts = accountOperations({
    users,
    ownership,
    clock: systemClock,
    ids: uuidV7Generator,
    legalVersions: { terms: TERMS_VERSION, privacy: PRIVACY_VERSION },
    consents: users,
  });

  const homeRepository = new DrizzleHomeRepository(database.db, cipher);
  const photoRepository = new DrizzlePhotoRepository(database.db);
  const photoStorage = adapters.photoStorage ?? new CloudPhotoStorage(config.storage);
  const homes = homeOperations({
    homes: homeRepository,
    photos: photoRepository,
    storage: photoStorage,
    places: adapters.placeResolver ?? placeResolverFor(config),
    clock: systemClock,
    ids: uuidV7Generator,
  });

  const photos = photoOperations({
    homes: homeRepository,
    photos: photoRepository,
    storage: photoStorage,
    images: adapters.imageProcessor ?? new SharpImageProcessor(),
    clock: systemClock,
    ids: uuidV7Generator,
  });
  const adminHomes = moderationOperations({
    units: new DrizzleUnitOfWork(database.db, cipher),
    homes: homeRepository,
    photos: photoRepository,
    storage: photoStorage,
    clock: systemClock,
  });
  // `resolveEffectivePreferences` queda disponible para el descubrimiento (add-discovery-feed)
  const searchPreferences = searchPreferencesOperations({
    homes: homeRepository,
    preferences: new DrizzleSearchPreferencesRepository(database.db),
    ids: uuidV7Generator,
  });
  const app = buildApp({
    logger: config.logger,
    landingOrigin: config.landingOrigin,
    appOrigins: config.appOrigins,
    trustProxyHops: config.trustProxyHops,
    security: {
      authenticate: (token) => resolvePrincipal({ verifier, users, ownership }, token),
    },
    waitlist: {
      joinWaitlist: (command) => joinWaitlist(waitlistDeps, command),
      rateLimit: config.waitlistRateLimit,
    },
    accounts,
    homes,
    photos,
    adminHomes,
    searchPreferences,
  });

  return {
    app,
    close: async () => {
      await app.close();
      await closeIdentity();
      await database.close();
    },
  };
}

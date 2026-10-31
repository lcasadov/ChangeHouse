import { PRIVACY_VERSION, TERMS_VERSION } from '@changehouse/shared';

import { accountDeletionOperations } from './application/account/account-deletion.js';
import { accountExportOperations } from './application/account/account-export.js';
import { accountOperations } from './application/account/account-operations.js';
import { finishAccountDeletion } from './application/account/finish-account-deletion.js';
import type { HomeOwnership } from './application/account/home-ownership.js';
import type { IdentityRemover } from './application/account/identity-remover.js';
import { resolvePrincipal } from './application/auth/resolve-principal.js';
import type { ChatChannel } from './application/chat/chat-channel.js';
import type { ChatImageStorage } from './application/chat/chat-image-storage.js';
import { chatOperations } from './application/chat/chat-operations.js';
import type { Clock } from './application/clock.js';
import { decisionOperations } from './application/decision/decision-operations.js';
import type { MatchLookup } from './application/decision/decision-repository.js';
import { discoveryOperations } from './application/discovery/discovery-operations.js';
import { homeOperations } from './application/home/home-operations.js';
import type { ImageProcessor } from './application/home/image-processor.js';
import { photoOperations } from './application/home/photo-operations.js';
import type { PhotoStorage } from './application/home/photo-storage.js';
import type { PlaceResolver } from './application/home/place-resolver.js';
import { matchOperations } from './application/matching/match-operations.js';
import { moderationOperations } from './application/moderation/moderation-operations.js';
import { reportOperations } from './application/moderation/report-operations.js';
import type { ChatMessageLookup } from './application/moderation/report-sources.js';
import {
  notificationHandlers,
  notificationOperations,
} from './application/notifications/notification-operations.js';
import type { Notifier } from './application/notifications/notifier.js';
import type { UserContactDirectory } from './application/notifications/user-contact-directory.js';
import { MATCH_CREATED, USER_DELETED } from './application/outbox/outbox.js';
import { OutboxDispatcher } from './application/outbox/outbox-dispatcher.js';
import { searchPreferencesOperations } from './application/search-preferences/search-preferences-operations.js';
import { joinWaitlist } from './application/waitlist/join-waitlist.js';
import type { ApiConfig } from './config.js';
import { createFirebaseIdentityVerifier } from './infrastructure/auth/firebase-identity-verifier.js';
import { createFirestoreChatChannel } from './infrastructure/chat/firestore-chat-channel.js';
import { AddressCipher } from './infrastructure/crypto/address-cipher.js';
import { SharpImageProcessor } from './infrastructure/images/sharp-image-processor.js';
import { createFirebaseNotifier } from './infrastructure/notifications/firebase-notifier.js';
import { createDatabase } from './infrastructure/persistence/drizzle/database.js';
import { DrizzleAccountDeletionUnitOfWork } from './infrastructure/persistence/drizzle/drizzle-account-deletion-unit-of-work.js';
import { DrizzleAccountExportReader } from './infrastructure/persistence/drizzle/drizzle-account-export.js';
import { DrizzleBlockRepository } from './infrastructure/persistence/drizzle/drizzle-block-repository.js';
import { DrizzleChatMemberships } from './infrastructure/persistence/drizzle/drizzle-chat-memberships.js';
import { DrizzleChatSetup } from './infrastructure/persistence/drizzle/drizzle-chat-setup.js';
import { DrizzleDecisionUnitOfWork } from './infrastructure/persistence/drizzle/drizzle-decision-unit-of-work.js';
import { DrizzleDeviceRepository } from './infrastructure/persistence/drizzle/drizzle-device-repository.js';
import { DrizzleDiscoveryRepository } from './infrastructure/persistence/drizzle/drizzle-discovery-repository.js';
import { DrizzleErasureFollowUp } from './infrastructure/persistence/drizzle/drizzle-erasure-follow-up.js';
import { DrizzleHomeOwnership } from './infrastructure/persistence/drizzle/drizzle-home-ownership.js';
import { DrizzleHomeRepository } from './infrastructure/persistence/drizzle/drizzle-home-repository.js';
import { DrizzleMatchHomes } from './infrastructure/persistence/drizzle/drizzle-match-homes.js';
import { DrizzleMatchRepository } from './infrastructure/persistence/drizzle/drizzle-match-repository.js';
import { DrizzleMatchUnitOfWork } from './infrastructure/persistence/drizzle/drizzle-match-unit-of-work.js';
import {
  DrizzleOutbox,
  DrizzleOutboxWriter,
} from './infrastructure/persistence/drizzle/drizzle-outbox.js';
import { DrizzlePhotoRepository } from './infrastructure/persistence/drizzle/drizzle-photo-repository.js';
import { DrizzleReportRepository } from './infrastructure/persistence/drizzle/drizzle-report-repository.js';
import { DrizzleSearchPreferencesRepository } from './infrastructure/persistence/drizzle/drizzle-search-preferences-repository.js';
import { DrizzleUnitOfWork } from './infrastructure/persistence/drizzle/drizzle-unit-of-work.js';
import { DrizzleUserRepository } from './infrastructure/persistence/drizzle/drizzle-user-repository.js';
import { DrizzleWaitlistRepository } from './infrastructure/persistence/drizzle/drizzle-waitlist-repository.js';
import { FixturePlaceResolver } from './infrastructure/places/fixture-place-resolver.js';
import { GooglePlaceResolver } from './infrastructure/places/google-place-resolver.js';
import { CloudChatImageStorage } from './infrastructure/storage/cloud-chat-image-storage.js';
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
  /** Por defecto, el reloj del sistema. Las pruebas fijan el instante (límite diario de me gusta). */
  clock?: Clock;
  /** Por defecto, los matches reales de PostgreSQL (`DrizzleMatchRepository`). */
  matchLookup?: MatchLookup;
  /** Por defecto, Cloud Firestore (o su emulador si hay `FIRESTORE_EMULATOR_HOST`). */
  chatChannel?: ChatChannel;
  /** Por defecto, Cloud Firestore (o su emulador): lee el mensaje que se denuncia como evidencia. */
  chatMessages?: ChatMessageLookup;
  /** Por defecto, el bucket privado de Cloud Storage (o fake-gcs-server). */
  chatImageStorage?: ChatImageStorage;
  /** Por defecto, FCM y la colección `mail` de Firestore (Trigger Email). */
  notifier?: Notifier;
  /** Por defecto, Firebase Auth (o su emulador): email y verificación de cada participante. */
  userContacts?: UserContactDirectory;
  /** Por defecto, Firebase Auth (o su emulador): baja de las cuentas eliminadas. */
  identityRemover?: IdentityRemover;
}

const MS_PER_SECOND = 1000;

/** El canal sustituido por las pruebas o, por defecto, Firestore con su propia aplicación de Firebase. */
function chatChannelFor(
  config: ApiConfig,
  overrides: { channel?: ChatChannel | undefined; messages?: ChatMessageLookup | undefined },
) {
  const firestore = createFirestoreChatChannel(config.firebase);
  return {
    channel: overrides.channel ?? firestore.channel,
    messages: overrides.messages ?? firestore.messages,
    close: firestore.close,
  };
}

function placeResolverFor(config: ApiConfig): PlaceResolver {
  const apiKey = config.places.serverKey;
  return apiKey ? new GooglePlaceResolver({ apiKey }) : new FixturePlaceResolver();
}

/** Raíz de composición: une adaptadores, casos de uso y transporte. */
export function createApi(config: ApiConfig, adapters: ApiAdapters = {}) {
  const database = createDatabase(config.databaseUrl);
  const {
    verifier,
    remover,
    close: closeIdentity,
  } = createFirebaseIdentityVerifier(config.firebase);

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
  const preferencesRepository = new DrizzleSearchPreferencesRepository(database.db);
  const searchPreferences = searchPreferencesOperations({
    homes: homeRepository,
    preferences: preferencesRepository,
    ids: uuidV7Generator,
  });
  const discovery = discoveryOperations({
    homes: homeRepository,
    users,
    preferences: preferencesRepository,
    effectivePreferences: searchPreferences.resolveEffectivePreferences,
    candidates: new DrizzleDiscoveryRepository(database.db),
    photos: photoRepository,
    storage: photoStorage,
  });
  const matchRepository = new DrizzleMatchRepository(database.db);
  const decisions = decisionOperations({
    homes: homeRepository,
    units: new DrizzleDecisionUnitOfWork(database.db),
    matches: adapters.matchLookup ?? matchRepository,
    clock: adapters.clock ?? systemClock,
    ids: uuidV7Generator,
    likesPerDay: config.likesPerDay,
  });
  const matches = matchOperations({
    matches: matchRepository,
    homes: new DrizzleMatchHomes(database.db, cipher),
    photos: photoRepository,
    storage: photoStorage,
    units: new DrizzleMatchUnitOfWork(database.db),
    clock: adapters.clock ?? systemClock,
    ids: uuidV7Generator,
  });
  const accountData = {
    ...accountDeletionOperations({
      units: new DrizzleAccountDeletionUnitOfWork(database.db, cipher),
      clock: adapters.clock ?? systemClock,
      ids: uuidV7Generator,
    }),
    ...accountExportOperations({
      users,
      consents: users,
      homes: homeRepository,
      photos: photoRepository,
      storage: photoStorage,
      preferences: preferencesRepository,
      reader: new DrizzleAccountExportReader(database.db),
      clock: adapters.clock ?? systemClock,
    }),
  };
  const chatChannel = chatChannelFor(config, {
    channel: adapters.chatChannel,
    messages: adapters.chatMessages,
  });
  const chat = chatOperations({
    matches: matchRepository,
    setup: new DrizzleChatSetup(database.db),
    channel: chatChannel.channel,
    outbox: new DrizzleOutboxWriter(database.db),
    onEnqueueError: (error) => {
      app.log.error({ err: error }, 'No se pudo registrar el aviso de un mensaje ya publicado');
    },
    storage: adapters.chatImageStorage ?? new CloudChatImageStorage(config.storage),
    images: adapters.imageProcessor ?? new SharpImageProcessor(),
    clock: adapters.clock ?? systemClock,
    ids: uuidV7Generator,
  });
  const reportOps = reportOperations({
    reports: new DrizzleReportRepository(database.db),
    units: new DrizzleUnitOfWork(database.db, cipher),
    homes: homeRepository,
    users,
    blocks: new DrizzleBlockRepository(database.db),
    memberships: new DrizzleChatMemberships(database.db),
    messages: chatChannel.messages,
    clock: adapters.clock ?? systemClock,
    ids: uuidV7Generator,
  });
  const firebaseNotifier = createFirebaseNotifier(config.firebase);
  const notifications = notificationOperations({
    devices: new DrizzleDeviceRepository(database.db),
    roster: new DrizzleChatSetup(database.db),
    push: (adapters.notifier ?? firebaseNotifier.notifier).push,
    email: (adapters.notifier ?? firebaseNotifier.notifier).email,
    contacts: adapters.userContacts ?? firebaseNotifier.contacts,
    appUrl: config.appPublicUrl,
    clock: adapters.clock ?? systemClock,
  });
  const notificationOutbox = notificationHandlers(notifications);
  // Crea el chat y avisa de cada hecho fuera de su transacción: tras la petición, al arrancar y cada intervalo
  const outbox = new OutboxDispatcher({
    store: new DrizzleOutbox(database.db),
    handlers: {
      ...notificationOutbox,
      // Primero el chat (idempotente) y luego el aviso: si el aviso falla, el reintento no duplica el chat
      // Tras confirmar la baja lógica: fotos, chats y baja en Firebase Auth, todo reintentable
      [USER_DELETED]: (userId) =>
        finishAccountDeletion(
          {
            users,
            followUp: new DrizzleErasureFollowUp(database.db),
            storage: photoStorage,
            roster: new DrizzleChatSetup(database.db),
            chat: chatChannel.channel,
            identity: adapters.identityRemover ?? remover,
          },
          userId,
        ),
      [MATCH_CREATED]: async (matchId) => {
        await chat.createChatForMatch(matchId);
        await notificationOutbox[MATCH_CREATED](matchId);
      },
    },
    clock: adapters.clock ?? systemClock,
    intervalMs: config.outbox.intervalSeconds * MS_PER_SECOND,
    onError: (error, event) => {
      app.log.error({ err: error, outboxEventId: event.id }, 'No se pudo despachar el hecho');
    },
  });
  /** Tras la operación, despacha sin esperar los hechos que haya registrado. */
  function kickAfter<A extends unknown[], R>(operation: (...args: A) => Promise<R>) {
    return async (...args: A): Promise<R> => {
      const result = await operation(...args);
      outbox.kick();
      return result;
    };
  }
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
    accountData: { ...accountData, deleteMe: kickAfter(accountData.deleteMe) },
    devices: { registerDevice: notifications.registerDevice },
    homes,
    photos,
    adminHomes,
    reports: {
      createReport: reportOps.createReport,
      blockUser: reportOps.blockUser,
    },
    adminReports: {
      adminListReports: reportOps.adminListReports,
      adminResolveReport: reportOps.adminResolveReport,
    },
    searchPreferences,
    discovery,
    decisions: {
      ...decisions,
      likeHome: async (userId, command) => {
        const result = await decisions.likeHome(userId, command);
        if (result.match) outbox.kick();
        return result;
      },
    },
    matches: {
      ...matches,
      ...chat,
      confirmMatch: kickAfter(matches.confirmMatch),
      withdrawFromMatch: kickAfter(matches.withdrawFromMatch),
      sendMatchMessage: kickAfter(chat.sendMatchMessage),
    },
  });

  return {
    app,
    outbox,
    close: async () => {
      await outbox.stop();
      await app.close();
      await chatChannel.close();
      await firebaseNotifier.close();
      await closeIdentity();
      await database.close();
    },
  };
}

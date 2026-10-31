import { DELETED_DISPLAY_NAME } from '../../domain/account/account-deletion.js';
import type { PhotoStatus } from '../../domain/home/photo.js';
import type { ChatChannel } from '../chat/chat-channel.js';
import type { ChatSetup } from '../chat/chat-setup.js';
import { originalPath } from '../home/photo-paths.js';
import type { PhotoStorage } from '../home/photo-storage.js';
import type { IdentityRemover } from './identity-remover.js';
import type { UserRepository } from './user-repository.js';

/** Una foto de una vivienda del usuario eliminado, en cualquier estado. */
export interface ErasablePhoto {
  readonly homeId: string;
  readonly photoId: string;
  readonly status: PhotoStatus;
  /** Ruta de la foto publicada (solo significativa si está `ready`). */
  readonly storagePath: string;
}

/** Puerto de salida: lo que queda por limpiar tras confirmar la eliminación de la cuenta. */
export interface ErasureFollowUp {
  photosOf(userId: string): Promise<ErasablePhoto[]>;
  /** Borra las filas de las fotos de las viviendas del usuario. */
  deletePhotoRecords(userId: string): Promise<void>;
  /** Todos los matches en los que participa o participó el usuario. */
  matchIdsOf(userId: string): Promise<string[]>;
}

export interface FinishAccountDeletionDeps {
  users: Pick<UserRepository, 'findById'>;
  followUp: ErasureFollowUp;
  storage: Pick<PhotoStorage, 'deleteOriginal' | 'deletePublished'>;
  roster: Pick<ChatSetup, 'findRoster'>;
  chat: Pick<ChatChannel, 'anonymizeParticipant'>;
  identity: IdentityRemover;
}

async function deleteStoredPhotos(deps: FinishAccountDeletionDeps, userId: string): Promise<void> {
  for (const photo of await deps.followUp.photosOf(userId)) {
    await deps.storage.deleteOriginal(originalPath(photo.homeId, photo.photoId));
    if (photo.status === 'ready') await deps.storage.deletePublished(photo.storagePath);
  }
  await deps.followUp.deletePhotoRecords(userId);
}

/** Conserva los mensajes pero con el remitente renombrado, también el nombre en la bienvenida. */
async function anonymizeChats(deps: FinishAccountDeletionDeps, userId: string): Promise<void> {
  for (const matchId of await deps.followUp.matchIdsOf(userId)) {
    const roster = await deps.roster.findRoster(matchId);
    // Sin chat aún: se creará más tarde ya con el nombre anonimizado
    if (!roster?.chatId) continue;
    await deps.chat.anonymizeParticipant(roster.chatId, {
      senderId: userId,
      displayName: DELETED_DISPLAY_NAME,
      participantNames: roster.members.map((member) => member.displayName),
    });
  }
}

/**
 * Lo que sigue a la transacción de eliminar la cuenta (hecho `user.deleted` del outbox): borra las
 * fotos del almacenamiento, renombra al remitente en los chats y da de baja la cuenta en el proveedor
 * de identidad. Cada paso es idempotente: si uno falla, el despachador repite todo sin duplicar efectos.
 * Solo actúa sobre cuentas ya eliminadas.
 */
export async function finishAccountDeletion(
  deps: FinishAccountDeletionDeps,
  userId: string,
): Promise<void> {
  const user = await deps.users.findById(userId);
  if (!user || user.deletedAt === null) return;

  await deleteStoredPhotos(deps, userId);
  await anonymizeChats(deps, userId);
  await deps.identity.remove(user.firebaseUid);
}

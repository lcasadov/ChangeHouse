import { anonymizeUser } from '../../domain/account/account-deletion.js';
import type { User } from '../../domain/account/user.js';
import { closeHome } from '../../domain/home/home.js';
import { isLiveMatch, withdrawFromMatch } from '../../domain/matching/match.js';
import type { Clock } from '../clock.js';
import type { HomeRepository } from '../home/home-repository.js';
import type { IdGenerator } from '../id-generator.js';
import type { MatchDecisionStore } from '../matching/matching-repository.js';
import type { AuditLog } from '../moderation/audit-log.js';
import { MATCH_CLOSED, type OutboxWriter, USER_DELETED } from '../outbox/outbox.js';

/** Puerto de salida: lo que la eliminación de la cuenta toca de los usuarios y de sus datos derivados. */
export interface AccountDeletionStore {
  /** Lee la cuenta bloqueando su fila hasta el final de la transacción; `null` si no existe. */
  lockUser(userId: string): Promise<User | null>;
  /** Guarda la cuenta anonimizada. */
  saveAnonymized(user: User): Promise<void>;
  /** Matches `open` o `confirmed` en los que participa el usuario, por id. */
  liveMatchIds(userId: string): Promise<string[]>;
  /** Borra sus preferencias, dispositivos, me gusta y descartes (datos derivados sin valor legal). */
  eraseDerivedData(userId: string): Promise<void>;
  /**
   * Sobrescribe con nulos la dirección y la ubicación exactas de todas sus viviendas (RGPD art. 17):
   * ya cerradas, no se vuelven a leer ni a descifrar.
   */
  eraseExactLocation(userId: string): Promise<void>;
}

/** Todo lo que la eliminación escribe, en una misma transacción. */
export interface AccountDeletionScope {
  accounts: AccountDeletionStore;
  homes: Pick<HomeRepository, 'listByOwner' | 'save'>;
  matches: MatchDecisionStore;
  audit: AuditLog;
  /** El aviso de cada cierre y la baja posterior en el proveedor de identidad. */
  outbox: OutboxWriter;
}

/** Puerto de salida: ejecuta el trabajo en una transacción; si falla, nada queda confirmado. */
export interface AccountDeletionUnitOfWork {
  run<T>(work: (scope: AccountDeletionScope) => Promise<T>): Promise<T>;
}

export interface AccountDeletionDeps {
  units: AccountDeletionUnitOfWork;
  clock: Clock;
  ids: IdGenerator;
}

/** Cierra para todos cada match vivo del usuario: él queda `withdrawn` y la retirada se audita (RN-10). */
async function withdrawFromLiveMatches(
  deps: AccountDeletionDeps,
  scope: AccountDeletionScope,
  userId: string,
): Promise<void> {
  for (const matchId of await scope.accounts.liveMatchIds(userId)) {
    const match = await scope.matches.findForUpdate(matchId);
    // Otro proceso pudo cerrarlo entre la lectura y el bloqueo: ya no hay nada que retirar
    if (!match || !isLiveMatch(match)) continue;
    await scope.matches.saveState(matchId, withdrawFromMatch(match, userId));
    await scope.audit.record({
      actorId: userId,
      action: 'match.withdraw',
      entity: 'match',
      entityId: matchId,
      at: deps.clock.now(),
    });
    await scope.outbox.enqueue({
      id: deps.ids.next(),
      type: MATCH_CLOSED,
      aggregateId: matchId,
      at: deps.clock.now(),
    });
  }
}

/**
 * Elimina la cuenta (RF-05): borrado lógico con anonimización, viviendas cerradas y sin dirección ni ubicación exactas, matches vivos
 * cerrados para todos y datos derivados borrados, todo en una transacción. La baja en el proveedor
 * de identidad y la limpieza de fotos y chats no ocurren aquí: se encolan (`user.deleted`) para
 * hacerse tras confirmar y poder reintentarse. Repetirla sobre una cuenta eliminada no hace nada.
 */
export async function deleteAccount(deps: AccountDeletionDeps, userId: string): Promise<void> {
  await deps.units.run(async (scope) => {
    const user = await scope.accounts.lockUser(userId);
    if (!user || user.deletedAt !== null) return;

    // Todas las comprobaciones antes del primer efecto: una vivienda en operación lo impide todo
    const closedHomes = (await scope.homes.listByOwner(userId)).map(closeHome);

    await withdrawFromLiveMatches(deps, scope, userId);
    for (const home of closedHomes) await scope.homes.save(home);
    // Tras guardar las viviendas cerradas: de lo contrario el guardado reescribiría la dirección
    await scope.accounts.eraseExactLocation(userId);
    await scope.accounts.eraseDerivedData(userId);
    const at = deps.clock.now();
    await scope.accounts.saveAnonymized(anonymizeUser(user, at));
    await scope.audit.record({
      actorId: userId,
      action: 'user.delete',
      entity: 'user',
      entityId: userId,
      at,
    });
    await scope.outbox.enqueue({
      id: deps.ids.next(),
      type: USER_DELETED,
      aggregateId: userId,
      at,
    });
  });
}

/** El caso de uso con sus dependencias ya inyectadas, listo para el transporte. */
export function accountDeletionOperations(deps: AccountDeletionDeps) {
  return { deleteMe: (userId: string) => deleteAccount(deps, userId) };
}

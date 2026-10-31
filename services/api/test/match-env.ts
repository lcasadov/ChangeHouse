import { matchOperations } from '../src/application/matching/match-operations.js';
import type { MatchRecord } from '../src/application/matching/matching-repository.js';
import {
  InMemoryAuditLog,
  InMemoryHomeRepository,
  InMemoryMatchHomes,
  InMemoryMatchReader,
  InMemoryMatchUnitOfWork,
  InMemoryOutbox,
  InMemoryPhotoRepository,
  InMemoryPhotoStorage,
} from './fakes.js';

export const MATCH_NOW = new Date('2026-10-20T08:30:00.000Z');

/** Los casos de uso de los matches con todos sus adaptadores en memoria a la vista de la prueba. */
export function matchEnv(records: MatchRecord[]) {
  const reader = new InMemoryMatchReader(records);
  const homes = new InMemoryHomeRepository();
  const photos = new InMemoryPhotoRepository();
  const audit = new InMemoryAuditLog();
  const outbox = new InMemoryOutbox();
  const units = new InMemoryMatchUnitOfWork(reader, audit, outbox);
  const matchHomes = new InMemoryMatchHomes(homes);
  let sequence = 0;
  const operations = matchOperations({
    matches: reader,
    homes: matchHomes,
    photos,
    storage: new InMemoryPhotoStorage(),
    units,
    clock: { now: () => MATCH_NOW },
    ids: { next: () => `evento-${String(++sequence)}` },
  });
  return { reader, homes, photos, audit, units, matchHomes, operations, outbox };
}

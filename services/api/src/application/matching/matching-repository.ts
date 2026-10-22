import type { AcceptedCycle, CycleHome, CycleType } from '../../domain/matching/cycle.js';
import type { MatchStatus, ParticipantStatus } from '../../domain/matching/match.js';
import type { ModerationCursor } from '../moderation/cursor.js';

/**
 * Puerto de salida: los ciclos candidatos que cierra la arista `from → to` recién insertada
 * (README §11), leídos dentro de la transacción del me gusta. Cada ciclo es una lista ordenada que
 * empieza en `from`: cada vivienda dio «Me gusta» a la siguiente y la última a la primera. Por
 * ahora solo ciclos de 2; los de 3 llegan con `add-chain-match` sin tocar el dominio.
 */
export interface CycleCandidates {
  findCycles(fromHomeId: string, toHomeId: string): Promise<CycleHome[][]>;
}

/** Un ciclo ya aceptado por el dominio, con su identificador y el instante de creación. */
export interface NewMatch {
  readonly id: string;
  readonly createdAt: Date;
  readonly cycle: AcceptedCycle;
}

/** Un participante tal como se guarda, con el nombre visible de su propietario. */
export interface MatchParticipantRecord {
  readonly homeId: string;
  readonly userId: string;
  readonly displayName: string;
  readonly givesHomeId: string;
  readonly receivesHomeId: string;
  readonly compensationCents: number;
  readonly status: ParticipantStatus;
}

/** Un match guardado; los participantes, por identificador de vivienda. */
export interface MatchRecord {
  readonly id: string;
  readonly type: CycleType;
  readonly status: MatchStatus;
  readonly createdAt: Date;
  readonly participants: readonly MatchParticipantRecord[];
}

/** Puerto de salida: crea matches dentro de la transacción del me gusta. */
export interface MatchWriter {
  /**
   * Guarda el match y sus participantes si no existía otro con la misma clave de ciclo; devuelve
   * el id del creado o, si ya existía, el del existente (nunca falla por duplicado).
   */
  saveMatch(match: NewMatch): Promise<string>;
  findMatch(id: string): Promise<MatchRecord | null>;
}

/** Lo que la transacción de una decisión necesita para detectar y crear matches. */
export interface MatchingTransaction {
  readonly cycles: CycleCandidates;
  readonly matches: MatchWriter;
}

/** Matches en los que participa una vivienda del usuario, del más reciente al más antiguo. */
export interface MatchListQuery {
  readonly userId: string;
  readonly status?: MatchStatus;
  /** Continúa tras esta posición (exclusiva): fecha de creación e id. */
  readonly after?: ModerationCursor;
  readonly limit: number;
}

/** Puerto de salida: lectura de los matches de un usuario. */
export interface MatchReader {
  listForUser(query: MatchListQuery): Promise<MatchRecord[]>;
}

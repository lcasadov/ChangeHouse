/** Estados de un match (`MatchStatus` del contrato); `in_operation` llega en la fase 2. */
export const MATCH_STATUSES = ['open', 'confirmed', 'in_operation', 'closed', 'expired'] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

/** Estado de cada participante (`ParticipantStatus` del contrato). */
export const PARTICIPANT_STATUSES = ['pending', 'confirmed', 'withdrawn'] as const;
export type ParticipantStatus = (typeof PARTICIPANT_STATUSES)[number];

/** Un match recién formado nace abierto y con todos sus participantes pendientes de confirmar. */
export const NEW_MATCH_STATUS: MatchStatus = 'open';
export const NEW_PARTICIPANT_STATUS: ParticipantStatus = 'pending';

import type { Href } from 'expo-router';

import { matchRoutes } from '../matches/match-routes';

const MATCH_ID = /^[\w-]+$/;

/** Tipos de evento que abren el detalle del match (nuevo match, confirmado o cerrado). */
const OPENS_DETAIL = new Set(['match.created', 'match.confirmed', 'match.closed']);
/** Tipo de evento que abre el chat del match (mensaje nuevo). */
const OPENS_CHAT = 'message.sent';

/**
 * A dónde lleva tocar un aviso. Los datos vienen del sistema operativo y no son de fiar: solo se
 * navega con un tipo conocido y un identificador de match con forma de identificador.
 */
export function notificationTarget(data: unknown): Href | null {
  if (typeof data !== 'object' || data === null) return null;
  const { type, matchId } = data as Record<string, unknown>;
  if (typeof matchId !== 'string' || !MATCH_ID.test(matchId)) return null;
  if (typeof type !== 'string') return null;
  if (OPENS_DETAIL.has(type)) return matchRoutes.detail(matchId);
  return type === OPENS_CHAT ? matchRoutes.chat(matchId) : null;
}

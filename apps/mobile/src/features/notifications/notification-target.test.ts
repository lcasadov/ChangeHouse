import { matchRoutes } from '../matches/match-routes';
import { notificationTarget } from './notification-target';

const MATCH = '0198f3a0-cccc-7000-8000-000000000001';

describe('notificationTarget', () => {
  it.each(['match.created', 'match.confirmed', 'match.closed'])(
    'un aviso %s abre el detalle del match',
    (type) => {
      expect(notificationTarget({ type, matchId: MATCH })).toBe(matchRoutes.detail(MATCH));
    },
  );

  it('un mensaje nuevo abre el chat del match', () => {
    expect(notificationTarget({ type: 'message.sent', matchId: MATCH })).toBe(
      matchRoutes.chat(MATCH),
    );
  });

  it.each([
    ['un tipo desconocido', { type: 'otro', matchId: MATCH }],
    ['sin match', { type: 'match.created' }],
    ['con un match vacío', { type: 'match.created', matchId: '' }],
    ['con un match que no es texto', { type: 'match.created', matchId: 7 }],
    ['con un match que no es un identificador', { type: 'match.created', matchId: '../admin' }],
    ['sin datos', undefined],
    ['con datos que no son un objeto', 'match.created'],
  ])('ignora un aviso %s', (_name, data) => {
    expect(notificationTarget(data)).toBeNull();
  });
});

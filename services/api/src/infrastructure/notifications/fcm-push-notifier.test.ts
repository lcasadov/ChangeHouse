import type { Messaging } from 'firebase-admin/messaging';
import { describe, expect, it } from 'vitest';

import { FcmPushNotifier } from './fcm-push-notifier.js';

const NOTIFICATION = {
  title: '¡Tienes un match!',
  body: 'Entra para verlo.',
  data: { type: 'match.created', matchId: 'm-1' },
} as const;

interface Sent {
  tokens: string[];
  notification: { title: string; body: string };
  data: Record<string, string>;
}

function messagingWith(
  respond: (message: Sent) => { success: boolean; error?: { code: string } }[],
) {
  const calls: Sent[] = [];
  const messaging = {
    sendEachForMulticast: (message: Sent) => {
      calls.push(message);
      return Promise.resolve({ responses: respond(message) });
    },
  } as unknown as Messaging;
  return { messaging, calls };
}

describe('FcmPushNotifier', () => {
  it('envía el título, el cuerpo y solo los datos indicados a todos los tokens', async () => {
    const { messaging, calls } = messagingWith((message) =>
      message.tokens.map(() => ({ success: true })),
    );

    const result = await new FcmPushNotifier(messaging).send(['t1', 't2'], NOTIFICATION);

    expect(result).toEqual({ invalidTokens: [] });
    expect(calls).toEqual([
      {
        tokens: ['t1', 't2'],
        notification: { title: NOTIFICATION.title, body: NOTIFICATION.body },
        data: { type: 'match.created', matchId: 'm-1' },
      },
    ]);
  });

  it('Scenario: Token inválido - devuelve los que FCM da por no registrados o con argumento inválido, y no los demás errores', async () => {
    const codes = [
      'messaging/registration-token-not-registered',
      'messaging/invalid-argument',
      'messaging/internal-error',
    ];
    const { messaging } = messagingWith((message) =>
      message.tokens.map((_token, index) =>
        index === 3 ? { success: true } : { success: false, error: { code: codes[index] ?? '' } },
      ),
    );

    const result = await new FcmPushNotifier(messaging).send(['a', 'b', 'c', 'd'], NOTIFICATION);

    expect(result.invalidTokens).toEqual(['a', 'b']);
  });

  it('Scenario: Fallo del envío - si todos los envíos fallan por un motivo transitorio lanza para que se reintente', async () => {
    const { messaging } = messagingWith((message) =>
      message.tokens.map(() => ({ success: false, error: { code: 'messaging/unavailable' } })),
    );

    await expect(new FcmPushNotifier(messaging).send(['a', 'b'], NOTIFICATION)).rejects.toThrow(
      'messaging/unavailable',
    );
  });

  it('un error de FCM sin código también se trata como transitorio', async () => {
    const { messaging } = messagingWith((message) =>
      message.tokens.map(() => ({ success: false })),
    );

    await expect(new FcmPushNotifier(messaging).send(['a'], NOTIFICATION)).rejects.toThrow();
  });

  it('parte los tokens en lotes de 500, el máximo de FCM', async () => {
    const { messaging, calls } = messagingWith((message) =>
      message.tokens.map(() => ({ success: true })),
    );
    const tokens = Array.from({ length: 1001 }, (_, index) => `t${String(index)}`);

    await new FcmPushNotifier(messaging).send(tokens, NOTIFICATION);

    expect(calls.map((call) => call.tokens.length)).toEqual([500, 500, 1]);
  });

  it('sin tokens no llama a FCM', async () => {
    const { messaging, calls } = messagingWith(() => []);

    await expect(new FcmPushNotifier(messaging).send([], NOTIFICATION)).resolves.toEqual({
      invalidTokens: [],
    });
    expect(calls).toEqual([]);
  });
});

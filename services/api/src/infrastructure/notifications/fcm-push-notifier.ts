import type { Messaging } from 'firebase-admin/messaging';

import type {
  PushNotification,
  PushNotifier,
  PushResult,
} from '../../application/notifications/notifier.js';

/** Máximo de tokens por llamada a `sendEachForMulticast`. */
const FCM_BATCH_SIZE = 500;

/** Códigos con los que FCM declara que el token ya no sirve (RF-61): hay que borrarlo. */
const INVALID_TOKEN_CODES: ReadonlySet<string> = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-argument',
]);

function batches<T>(items: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    result.push(items.slice(start, start + size));
  }
  return result;
}

/**
 * Adaptador de `PushNotifier` sobre Firebase Cloud Messaging. Un token rechazado como inválido se
 * devuelve para borrarlo; si fallan todos los envíos por otro motivo (servicio caído) lanza, para
 * que el despachador reintente.
 */
export class FcmPushNotifier implements PushNotifier {
  constructor(private readonly messaging: Messaging) {}

  async send(tokens: readonly string[], notification: PushNotification): Promise<PushResult> {
    const invalidTokens: string[] = [];
    let failures = 0;
    let lastCode = 'desconocido';
    for (const batch of batches(tokens, FCM_BATCH_SIZE)) {
      const { responses } = await this.messaging.sendEachForMulticast({
        tokens: batch,
        notification: { title: notification.title, body: notification.body },
        data: { type: notification.data.type, matchId: notification.data.matchId },
      });
      responses.forEach((response, index) => {
        if (response.success) return;
        const code = response.error?.code ?? 'desconocido';
        const token = batch[index];
        if (INVALID_TOKEN_CODES.has(code) && token !== undefined) {
          invalidTokens.push(token);
        } else {
          failures += 1;
          lastCode = code;
        }
      });
    }
    const delivered = tokens.length - invalidTokens.length - failures;
    if (failures > 0 && delivered === 0) throw new Error(`FCM no entregó el aviso: ${lastCode}`);
    return { invalidTokens };
  }
}

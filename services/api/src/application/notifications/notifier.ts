/** Tipos de aviso; coinciden con los hechos de la bandeja de salida que los originan. */
export type NotificationType =
  'match.created' | 'match.confirmed' | 'match.closed' | 'message.sent';

/** Aviso push: texto genérico y solo el tipo y el match en los datos (nunca datos privados). */
export interface PushNotification {
  readonly title: string;
  readonly body: string;
  readonly data: { readonly type: NotificationType; readonly matchId: string };
}

export interface PushResult {
  /** Tokens que el servicio de mensajería declara inválidos: hay que borrarlos. */
  readonly invalidTokens: readonly string[];
}

/** Puerto de salida: envío de avisos push (FCM). Lanza si el servicio no responde, para reintentar. */
export interface PushNotifier {
  send(tokens: readonly string[], notification: PushNotification): Promise<PushResult>;
}

/** Correo ya redactado, listo para entregar. */
export interface EmailNotification {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

/** Puerto de salida: envío de correo (Trigger Email sobre Firestore). */
export interface EmailNotifier {
  send(email: EmailNotification): Promise<void>;
}

/** Los dos canales de aviso. */
export interface Notifier {
  readonly push: PushNotifier;
  readonly email: EmailNotifier;
}

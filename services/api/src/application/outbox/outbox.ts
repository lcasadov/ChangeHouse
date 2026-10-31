/** Hechos de negocio que se propagan por la bandeja de salida. */
export const MATCH_CREATED = 'match.created';
export const MATCH_CONFIRMED = 'match.confirmed';
export const MATCH_CLOSED = 'match.closed';
export const MESSAGE_SENT = 'message.sent';
/** Cuenta eliminada: queda por dar de baja en el proveedor de identidad y limpiar fotos y chats. */
export const USER_DELETED = 'user.deleted';

/** Identificadores que el manejador necesita además del agregado; nunca datos personales. */
export type OutboxPayload = Readonly<Record<string, string>>;

/** Un hecho recién ocurrido, a guardar en la misma transacción que el cambio de negocio. */
export interface NewOutboxEvent {
  readonly id: string;
  readonly type: string;
  readonly aggregateId: string;
  readonly payload?: OutboxPayload;
  readonly at: Date;
}

/** Un hecho pendiente de propagar; `attempts` cuenta los intentos fallidos anteriores. */
export interface PendingOutboxEvent {
  readonly id: string;
  readonly type: string;
  readonly aggregateId: string;
  readonly payload: OutboxPayload | null;
  readonly attempts: number;
}

/**
 * Puerto de salida: registra un hecho dentro de la transacción de negocio. Un mismo hecho (tipo y
 * agregado) se guarda una sola vez: registrarlo de nuevo no hace nada.
 */
export interface OutboxWriter {
  enqueue(event: NewOutboxEvent): Promise<void>;
}

export interface ProcessSummary {
  processed: number;
  failed: number;
}

/**
 * Puerto de salida: entrega los hechos pendientes, del más antiguo al más reciente, a `handle`. Si
 * `handle` termina bien, el hecho queda procesado; si falla, sigue pendiente con un intento más y
 * se pasa al siguiente. Dos procesadores simultáneos nunca reciben el mismo hecho.
 */
export interface OutboxProcessor {
  processPending(
    limit: number,
    handle: (event: PendingOutboxEvent) => Promise<void>,
    at: Date,
  ): Promise<ProcessSummary>;
}

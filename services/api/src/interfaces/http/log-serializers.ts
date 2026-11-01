/**
 * Serializadores del registro (Cloud Logging): ni la query string de la URL (puede llevar búsquedas
 * por email) ni el detalle de los errores de la base de datos (trae los valores de las filas) se
 * escriben nunca.
 */

/** La parte de la petición que Fastify entrega al serializador. */
export interface LoggedRequest {
  method?: string;
  url?: string;
  headers?: Record<string, unknown>;
  host?: string;
  ip?: string;
  socket?: { remotePort?: number };
}

function acceptVersion(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/** Como el serializador de Fastify, pero con la ruta sin query string. */
export function serializeRequest(request: LoggedRequest) {
  return {
    method: request.method,
    url: request.url?.split('?')[0],
    version: acceptVersion(request.headers?.['accept-version']),
    host: request.host,
    remoteAddress: request.ip,
    remotePort: request.socket?.remotePort,
  };
}

/**
 * Campos de los errores de PostgreSQL (`postgres.js`) y de Drizzle que contienen valores: el
 * detalle de la fila, el contexto de la sentencia y los parámetros enlazados.
 */
const SENSITIVE_ERROR_FIELDS = new Set(['detail', 'where', 'parameters', 'params']);
/** Un error de Drizzle añade los parámetros a su mensaje tras esta marca. */
const DRIZZLE_PARAMS_MARKER = '\nparams:';
const MAX_CAUSE_DEPTH = 3;

function withoutParams(text: string): string {
  const index = text.indexOf(DRIZZLE_PARAMS_MARKER);
  return index === -1 ? text : text.slice(0, index);
}

/** Como el serializador de errores de pino, sin los campos que llevan valores de filas ni parámetros. */
export function serializeError(error: unknown, depth = 0): unknown {
  if (!(error instanceof Error)) return error;
  const serialized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(error)) {
    if (!SENSITIVE_ERROR_FIELDS.has(key) && key !== 'cause') serialized[key] = value;
  }
  serialized['type'] = error.name;
  serialized['message'] = withoutParams(error.message);
  if (error.stack) {
    serialized['stack'] = error.stack.replace(error.message, withoutParams(error.message));
  }
  if (error.cause !== undefined && depth < MAX_CAUSE_DEPTH) {
    serialized['cause'] = serializeError(error.cause, depth + 1);
  }
  return serialized;
}

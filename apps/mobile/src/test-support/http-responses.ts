/** Respuestas HTTP de la API simulada: cuerpo JSON y `Problem` (RFC 9457) como los del contrato. */
export const problem = (
  status: number,
  extra: Record<string, unknown> = {},
  headers: Record<string, string> = {},
) =>
  new Response(
    JSON.stringify({
      type: 'about:blank',
      title: 'Error',
      status,
      correlationId: 'corr-1',
      ...extra,
    }),
    { status, headers: { 'content-type': 'application/problem+json', ...headers } },
  );

export const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

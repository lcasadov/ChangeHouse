import { type FastifyPluginCallback, type FastifyRequest } from 'fastify';

import type {
  AdminPanelOperations,
  WaitlistEntryView,
} from '../../../application/admin/admin-operations.js';
import { resolvePeriod } from '../../../domain/admin/period.js';
import { type FieldError, ValidationFailedError } from '../problem.js';
import { NUMERIC_ID, type PageParams, parsePage } from './request-helpers.js';

export type AdminPanelRouteOptions = AdminPanelOperations;

const MAX_SEARCH_LENGTH = 200;
const MAX_MUNICIPALITY_LENGTH = 120;
const CSV_HEADER = [
  'email',
  'municipio',
  'tipo de vivienda',
  'qué busca',
  'fecha de consentimiento',
];
const CSV_MEDIA_TYPE = 'text/csv';
/** Primeros caracteres con los que una hoja de cálculo interpreta una celda como fórmula. */
const FORMULA_START = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /[",\r\n]/;

interface UsersQuery extends PageParams {
  q?: string;
}

interface WaitlistQuery extends PageParams {
  municipality?: string;
}

interface MetricsQuery {
  from?: string;
  to?: string;
}

/** Texto opcional del filtro: recortado, sin valor si queda vacío y 400 si excede el máximo. */
function optionalText(
  value: string | undefined,
  field: string,
  max: number,
  errors: FieldError[],
): string | undefined {
  const text = value?.trim();
  if (text !== undefined && text.length > max) errors.push({ field, message: 'too_long' });
  return text === undefined || text === '' ? undefined : text;
}

function failIfInvalid(errors: FieldError[]): void {
  if (errors.length > 0) throw new ValidationFailedError(errors);
}

/** Una celda del CSV: neutraliza las fórmulas con un apóstrofo y entrecomilla lo que lo necesite. */
function csvCell(value: string): string {
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return NEEDS_QUOTES.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

function toCsv(entries: readonly WaitlistEntryView[]): string {
  const rows = entries.map((entry) => [
    entry.email,
    entry.municipality,
    entry.homeType,
    entry.lookingFor,
    entry.consentAt,
  ]);
  return [CSV_HEADER, ...rows].map((row) => `${row.map(csvCell).join(',')}\r\n`).join('');
}

function wantsCsv(request: FastifyRequest): boolean {
  return (request.headers.accept ?? '').toLowerCase().includes(CSV_MEDIA_TYPE);
}

/**
 * `adminGetMetrics`, `adminListUsers`, `adminListAuditLog` y `adminListWaitlist` del contrato
 * (RF-90, RF-91, RF-93, RF-101). Solo transporte y formato: la política central las restringe al rol
 * `admin` y los casos de uso consultan.
 */
export function adminPanelRoutes(options: AdminPanelRouteOptions): FastifyPluginCallback {
  return (app, _options, done) => {
    app.get<{ Querystring: MetricsQuery }>(
      '/admin/metrics',
      { config: { operationId: 'adminGetMetrics' } },
      (request) => {
        const result = resolvePeriod(request.query.from, request.query.to);
        if (!result.success) {
          throw new ValidationFailedError(
            result.errors.map((error) => ({ field: error.field, message: error.code })),
          );
        }
        return options.adminGetMetrics(result.period);
      },
    );

    app.get<{ Querystring: UsersQuery }>(
      '/admin/users',
      { config: { operationId: 'adminListUsers' } },
      (request) => {
        const errors: FieldError[] = [];
        const q = optionalText(request.query.q, 'q', MAX_SEARCH_LENGTH, errors);
        const { cursor, limit } = parsePage(request.query, errors);
        failIfInvalid(errors);
        return options.adminListUsers({
          ...(q === undefined ? {} : { q }),
          ...(cursor === undefined ? {} : { cursor }),
          limit,
        });
      },
    );

    app.get<{ Querystring: PageParams }>(
      '/admin/audit-log',
      { config: { operationId: 'adminListAuditLog' } },
      (request) => {
        const errors: FieldError[] = [];
        const { cursor, limit } = parsePage(request.query, errors, NUMERIC_ID);
        failIfInvalid(errors);
        return options.adminListAuditLog({
          ...(cursor === undefined ? {} : { cursor }),
          limit,
        });
      },
    );

    app.get<{ Querystring: WaitlistQuery }>(
      '/admin/waitlist',
      { config: { operationId: 'adminListWaitlist' } },
      async (request, reply) => {
        const errors: FieldError[] = [];
        const municipality = optionalText(
          request.query.municipality,
          'municipality',
          MAX_MUNICIPALITY_LENGTH,
          errors,
        );
        const { cursor, limit } = parsePage(request.query, errors);
        failIfInvalid(errors);
        const filter = municipality === undefined ? {} : { municipality };

        if (wantsCsv(request)) {
          const entries = await options.adminExportWaitlist(filter);
          return reply
            .type(`${CSV_MEDIA_TYPE}; charset=utf-8`)
            .header('content-disposition', 'attachment; filename="lista-de-espera.csv"')
            .send(toCsv(entries));
        }
        return options.adminListWaitlist({
          ...filter,
          ...(cursor === undefined ? {} : { cursor }),
          limit,
        });
      },
    );
    done();
  };
}

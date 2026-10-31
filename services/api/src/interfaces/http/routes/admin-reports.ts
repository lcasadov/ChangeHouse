import {
  REPORT_STATUSES,
  type ReportResolutionInput,
  type ReportStatus,
  validateReportResolutionInput,
} from '@changehouse/shared';
import type { FastifyPluginCallback } from 'fastify';

import { ReportNotFoundError } from '../../../application/moderation/report-errors.js';
import type {
  AdminReportsPage,
  AdminReportsQuery,
  ReportView,
} from '../../../application/moderation/report-operations.js';
import { type FieldError, ValidationFailedError } from '../problem.js';
import { accountId, type PageParams, parsePage, uuidOr404, validated } from './request-helpers.js';

export interface AdminReportRouteOptions {
  adminListReports: (query: AdminReportsQuery) => Promise<AdminReportsPage>;
  adminResolveReport: (
    adminId: string,
    reportId: string,
    input: ReportResolutionInput,
  ) => Promise<ReportView>;
}

interface ListQuery extends PageParams {
  status?: string;
}

/** `status`, `cursor` y `limit` de `adminListReports`; cada parámetro erróneo se señala por su nombre. */
function parseListQuery(query: ListQuery): AdminReportsQuery {
  const errors: FieldError[] = [];
  const status = query.status;
  if (status !== undefined && !(REPORT_STATUSES as readonly string[]).includes(status)) {
    errors.push({ field: 'status', message: 'invalid' });
  }
  const { cursor, limit } = parsePage(query, errors);

  if (errors.length > 0) throw new ValidationFailedError(errors);
  return {
    ...(status === undefined ? {} : { status: status as ReportStatus }),
    ...(cursor === undefined ? {} : { cursor }),
    limit,
  };
}

/**
 * `adminListReports` y `adminResolveReport` del contrato (RF-63, RF-90, RF-93). Solo transporte: la
 * política central restringe ambas al rol `admin` y el caso de uso decide y audita.
 */
export function adminReportRoutes(options: AdminReportRouteOptions): FastifyPluginCallback {
  return (app, _options, done) => {
    app.get<{ Querystring: ListQuery }>(
      '/admin/reports',
      { config: { operationId: 'adminListReports' } },
      (request) => options.adminListReports(parseListQuery(request.query)),
    );

    app.patch<{ Params: { reportId: string } }>(
      '/admin/reports/:reportId',
      { config: { operationId: 'adminResolveReport' } },
      (request) => {
        const reportId = uuidOr404(request.params.reportId, () => new ReportNotFoundError());
        const input = validated(validateReportResolutionInput(request.body));
        return options.adminResolveReport(accountId(request), reportId, input);
      },
    );
    done();
  };
}

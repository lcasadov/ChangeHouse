import { z } from 'zod';

import { validateWith } from './validation.js';

/** Lo que se puede denunciar (`ReportInput.targetType` en `docs/api/openapi.yaml`). */
export const REPORT_TARGET_TYPES = ['user', 'home', 'message'] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

/** Ciclo de vida de una denuncia (`ReportStatus`). */
export const REPORT_STATUSES = ['open', 'resolved', 'dismissed'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const MAX_REPORT_REASON = 1000;
export const MAX_REPORT_RESOLUTION = 2000;
export const MAX_REPORT_TARGET_ID = 128;

const reportInputBase = z.strictObject({
  targetType: z.enum(REPORT_TARGET_TYPES),
  targetId: z.string().min(1).max(MAX_REPORT_TARGET_ID),
  reason: z.string().trim().min(1).max(MAX_REPORT_REASON),
});

/** Cuerpo de `createReport`: un usuario o una vivienda se identifican por UUID; un mensaje, por su id de Firestore. */
export const reportInputSchema = reportInputBase.refine(
  (input) => input.targetType === 'message' || z.uuid().safeParse(input.targetId).success,
  { path: ['targetId'], error: 'invalid' },
);
export type ReportInput = z.output<typeof reportInputSchema>;

export const validateReportInput = (input: unknown) => validateWith(reportInputSchema, input);

/** Cuerpo de `blockUser`. */
export const blockUserInputSchema = z.strictObject({ userId: z.uuid() });
export type BlockUserInput = z.output<typeof blockUserInputSchema>;

export const validateBlockUserInput = (input: unknown) => validateWith(blockUserInputSchema, input);

/** Cuerpo de `adminResolveReport`: la nota es obligatoria (design de `add-reports-and-blocking`). */
export const reportResolutionInputSchema = z.strictObject({
  status: z.enum(['resolved', 'dismissed']),
  resolution: z.string().trim().min(1).max(MAX_REPORT_RESOLUTION),
});
export type ReportResolutionInput = z.output<typeof reportResolutionInputSchema>;

export const validateReportResolutionInput = (input: unknown) =>
  validateWith(reportResolutionInputSchema, input);

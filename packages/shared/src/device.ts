import { z } from 'zod';

import { validateWith } from './validation.js';

/** Plataformas de un dispositivo registrado (`registerDevice` en `docs/api/openapi.yaml`). */
export const DEVICE_PLATFORMS = ['android', 'ios', 'web'] as const;
export type DevicePlatform = (typeof DEVICE_PLATFORMS)[number];

/** Longitud máxima del token FCM que admite el contrato. */
export const MAX_FCM_TOKEN_LENGTH = 4096;

/** Cuerpo de `registerDevice`. */
export const deviceInputSchema = z.strictObject({
  fcmToken: z.string().min(1).max(MAX_FCM_TOKEN_LENGTH),
  platform: z.enum(DEVICE_PLATFORMS),
});
export type DeviceInput = z.output<typeof deviceInputSchema>;

export const validateDeviceInput = (input: unknown) => validateWith(deviceInputSchema, input);

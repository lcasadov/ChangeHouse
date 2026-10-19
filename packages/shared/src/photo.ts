import { z } from 'zod';

import { validateWith } from './validation.js';

/** Formatos de foto que acepta `createHomePhotoUpload`. */
export const PHOTO_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/webp'] as const;
export type PhotoContentType = (typeof PHOTO_CONTENT_TYPES)[number];

/** Cuerpo de `createHomePhotoUpload`. */
export const photoUploadInputSchema = z.strictObject({ contentType: z.enum(PHOTO_CONTENT_TYPES) });
export type PhotoUploadInput = z.infer<typeof photoUploadInputSchema>;

export const validatePhotoUploadInput = (input: unknown) =>
  validateWith(photoUploadInputSchema, input);

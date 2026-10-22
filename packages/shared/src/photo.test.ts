import { describe, expect, it } from 'vitest';

import { PHOTO_CONTENT_TYPES, validatePhotoUploadInput } from './photo.js';

describe('validatePhotoUploadInput', () => {
  it.each(PHOTO_CONTENT_TYPES)('acepta el tipo %s', (contentType) => {
    expect(validatePhotoUploadInput({ contentType })).toEqual({
      success: true,
      data: { contentType },
    });
  });

  it('admite exactamente JPEG, PNG, HEIC y WebP (contrato de createHomePhotoUpload)', () => {
    expect([...PHOTO_CONTENT_TYPES]).toEqual([
      'image/jpeg',
      'image/png',
      'image/heic',
      'image/webp',
    ]);
  });

  it.each([
    [{ contentType: 'image/gif' }, 'contentType'],
    [{ contentType: 'application/pdf' }, 'contentType'],
    [{}, 'contentType'],
    [{ contentType: 'image/jpeg', extra: 1 }, 'extra'],
    [null, 'body'],
  ])('rechaza %j señalando %s', (input, field) => {
    const result = validatePhotoUploadInput(input);

    expect(result.success).toBe(false);
    expect(result.success ? [] : result.errors.map((error) => error.field)).toEqual([field]);
  });
});

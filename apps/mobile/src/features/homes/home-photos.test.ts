import {
  canRetry,
  failureOf,
  photosOf,
  supportedContentType,
  UploadTransferError,
} from './home-photos';
import { HomesApiError } from './homes-api';

describe('photosOf', () => {
  it('ordena por posición para que la primera sea la portada', () => {
    const photos = [
      { id: 'b', url: 'https://cdn.test/b.webp', position: 2 },
      { id: 'a', url: 'https://cdn.test/a.webp', position: 1 },
    ];

    expect(photosOf({ photos }).map((photo) => photo.id)).toEqual(['a', 'b']);
    expect(photosOf(undefined)).toEqual([]);
  });
});

describe('supportedContentType', () => {
  it.each(['image/jpeg', 'image/png', 'image/heic', 'image/webp'])('admite %s', (type) => {
    expect(supportedContentType(type)).toBe(type);
  });

  it.each(['image/gif', 'application/pdf', ''])('no admite «%s»', (type) => {
    expect(supportedContentType(type)).toBeNull();
  });
});

describe('failureOf', () => {
  it.each([
    [new UploadTransferError(), 'upload'],
    [new HomesApiError('network'), 'network'],
    [new HomesApiError('photo-limit'), 'limit'],
    [new HomesApiError('invalid-image'), 'invalidImage'],
    [new HomesApiError('photo-not-uploaded'), 'notUploaded'],
    [new HomesApiError('too-many-pending'), 'tooManyPending'],
    [new HomesApiError('busy'), 'busy'],
    [new HomesApiError('conflict'), 'notEditable'],
    [new HomesApiError('server'), 'unknown'],
    [new Error('otro'), 'unknown'],
  ] as const)('traduce %s a %s', (error, expected) => {
    expect(failureOf(error)).toBe(expected);
  });
});

describe('canRetry', () => {
  it('solo ofrece reintentar lo que puede arreglarse volviendo a intentarlo', () => {
    expect(canRetry('upload')).toBe(true);
    expect(canRetry('network')).toBe(true);
    expect(canRetry('invalidImage')).toBe(false);
    expect(canRetry('limit')).toBe(false);
    expect(canRetry('tooManyPending')).toBe(false);
    expect(canRetry('busy')).toBe(true);
    expect(canRetry(undefined)).toBe(false);
  });
});

import * as Sentry from '@sentry/react-native';

import { initSentry } from './sentry';

jest.mock('@sentry/react-native', () => ({ init: jest.fn() }));

describe('initSentry', () => {
  beforeEach(() => {
    jest.mocked(Sentry.init).mockClear();
  });

  it('no inicializa Sentry sin DSN', () => {
    expect(initSentry(undefined)).toBe(false);
    expect(initSentry('')).toBe(false);
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('inicializa Sentry con el DSN sin enviar datos personales', () => {
    expect(initSentry('https://clave@o0.ingest.sentry.io/1')).toBe(true);
    expect(Sentry.init).toHaveBeenCalledWith({
      dsn: 'https://clave@o0.ingest.sentry.io/1',
      sendDefaultPii: false,
    });
  });
});

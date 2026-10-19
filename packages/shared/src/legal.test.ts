import { describe, expect, it } from 'vitest';

import { PRIVACY_VERSION, TERMS_VERSION } from './legal.js';

describe('versiones de los textos legales', () => {
  it('las versiones vigentes son las del lanzamiento', () => {
    expect(TERMS_VERSION).toBe('2026-10');
    expect(PRIVACY_VERSION).toBe('2026-10');
  });
});

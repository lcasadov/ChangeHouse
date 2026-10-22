import { describe, expect, it } from 'vitest';

import { tokens } from './tokens.js';

describe('tokens', () => {
  it('declara los temas claro y oscuro', () => {
    expect(tokens.themes).toEqual(['light', 'dark']);
  });
});

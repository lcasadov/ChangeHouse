import { describe, expect, it } from 'vitest';

import type { MatchLookup } from '../../application/decision/decision-repository.js';
import { NoMatchLookup } from './no-match-lookup.js';

describe('NoMatchLookup', () => {
  it('mientras no existan los matches, ningún me gusta forma parte de uno', async () => {
    const lookup: MatchLookup = new NoMatchLookup();

    await expect(lookup.isLikeInMatch('desde', 'hacia')).resolves.toBe(false);
  });
});

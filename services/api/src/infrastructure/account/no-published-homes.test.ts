import { describe, expect, it } from 'vitest';

import { noPublishedHomes } from './no-published-homes.js';

describe('noPublishedHomes (provisional hasta add-home-listing)', () => {
  it('nadie tiene vivienda publicada todavía', async () => {
    await expect(noPublishedHomes.hasPublishedHome('cualquiera')).resolves.toBe(false);
  });
});

import { describe, expect, it } from 'vitest';

import { buildApp } from './app.js';

describe('buildApp', () => {
  it('queda listo y se puede cerrar', async () => {
    const app = buildApp();

    await expect(app.ready()).resolves.toBeDefined();
    await expect(app.close()).resolves.toBeUndefined();
  });

  it('no expone rutas todavía', async () => {
    const app = buildApp();

    const response = await app.inject({ method: 'GET', url: '/' });

    expect(response.statusCode).toBe(404);
    await app.close();
  });
});

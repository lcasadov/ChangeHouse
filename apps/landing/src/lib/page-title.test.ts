import { describe, expect, it } from 'vitest';

import { pageTitle, SITE_NAME } from './page-title';

describe('pageTitle', () => {
  it('devuelve el nombre del sitio cuando no hay página', () => {
    expect(pageTitle()).toBe(SITE_NAME);
  });

  it('ignora títulos en blanco', () => {
    expect(pageTitle('   ')).toBe(SITE_NAME);
  });

  it('antepone el título de la página', () => {
    expect(pageTitle(' Inicio ')).toBe('Inicio · ChangeHouse');
  });
});

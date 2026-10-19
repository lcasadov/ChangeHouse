import { hiddenTabRoute, navigationLayoutFor, TABS, tabsFor } from './tabs';

describe('TABS', () => {
  it('define las cuatro secciones en el orden de la guía', () => {
    expect(TABS.map((tab) => tab.section)).toEqual(['explore', 'matches', 'homes', 'profile']);
    expect(TABS.map((tab) => tab.route)).toEqual(['index', 'matches', 'homes', 'profile']);
  });
});

describe('navigationLayoutFor', () => {
  it('usa barra lateral solo en web ancha', () => {
    expect(navigationLayoutFor('web', 'expanded')).toBe('side');
  });

  it.each([
    ['web', 'compact'],
    ['web', 'medium'],
    ['ios', 'expanded'],
    ['android', 'expanded'],
    ['ios', 'compact'],
  ] as const)('usa pestañas inferiores en %s/%s', (os, breakpoint) => {
    expect(navigationLayoutFor(os, breakpoint)).toBe('bottom');
  });
});

describe('tabsFor', () => {
  it('sin rol de administración deja las cuatro secciones de siempre', () => {
    expect(tabsFor(false)).toEqual(TABS);
    expect(hiddenTabRoute(false)).toBe('admin');
  });

  it('para un admin, «Administración» ocupa el lugar de «Mis casas»', () => {
    expect(tabsFor(true).map((tab) => tab.section)).toEqual([
      'explore',
      'matches',
      'admin',
      'profile',
    ]);
    expect(hiddenTabRoute(true)).toBe('homes');
  });
});

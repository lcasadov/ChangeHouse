import { navigationLayoutFor, TABS } from './tabs';

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

import { space } from '@changehouse/ui';

import { feedMinHeight } from './feed-height';

describe('feedMinHeight', () => {
  it('Scenario: Tarjeta entera en pantalla - en un móvil de 844 px deja sitio a búsqueda, filtros y botones', () => {
    // Búsqueda, filtros, botones de decisión y pestañas ocupan unos 330 px en 390 × 844
    expect(feedMinHeight(844)).toBeLessThanOrEqual(844 - 330);
  });

  it('Scenario: Tarjeta entera en pantalla - en una ventana de 720 px cabe sin desplazar', () => {
    expect(feedMinHeight(720)).toBeLessThanOrEqual(720 - 300);
  });

  it('nunca baja del mínimo legible ni pasa del máximo de la tarjeta', () => {
    expect(feedMinHeight(400)).toBe(space[8] * 4);
    expect(feedMinHeight(2000)).toBe(space[8] * 6);
  });
});

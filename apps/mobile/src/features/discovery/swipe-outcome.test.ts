import { swipeOutcome, swipeProgress } from './swipe-outcome';

const WIDTH = 400;

describe('swipeOutcome', () => {
  it.each([
    [121, 0, 'like'],
    [-121, 0, 'dismiss'],
    [119, 0, null],
    [-119, 0, null],
    [0, 0, null],
  ] as const)(
    'con un desplazamiento de %d y velocidad %d, un 30 %% del ancho decide: %s',
    (translationX, velocityX, expected) => {
      expect(swipeOutcome({ translationX, velocityX, width: WIDTH })).toBe(expected);
    },
  );

  it.each([
    [40, 1200, 'like'],
    [-40, -1200, 'dismiss'],
    [40, 700, null],
    [-40, -700, null],
  ] as const)(
    'un gesto corto (%d) y rápido (%d) decide si supera la velocidad mínima: %s',
    (translationX, velocityX, expected) => {
      expect(swipeOutcome({ translationX, velocityX, width: WIDTH })).toBe(expected);
    },
  );

  it('un gesto rápido hacia el lado contrario al desplazamiento no decide (la persona se arrepiente)', () => {
    expect(swipeOutcome({ translationX: 40, velocityX: -1200, width: WIDTH })).toBeNull();
    expect(swipeOutcome({ translationX: -40, velocityX: 1200, width: WIDTH })).toBeNull();
  });

  it('sin saber el ancho de la tarjeta solo decide la velocidad', () => {
    expect(swipeOutcome({ translationX: 300, velocityX: 0, width: 0 })).toBeNull();
    expect(swipeOutcome({ translationX: 30, velocityX: 1500, width: 0 })).toBe('like');
  });
});

describe('swipeProgress', () => {
  it('crece de 0 a 1 hasta el umbral y se queda en 1 más allá, con el signo del lado', () => {
    expect(swipeProgress(0, WIDTH)).toBe(0);
    expect(swipeProgress(60, WIDTH)).toBeCloseTo(0.5);
    expect(swipeProgress(120, WIDTH)).toBe(1);
    expect(swipeProgress(300, WIDTH)).toBe(1);
    expect(swipeProgress(-60, WIDTH)).toBeCloseTo(-0.5);
    expect(swipeProgress(-300, WIDTH)).toBe(-1);
  });

  it('sin ancho conocido es 0', () => {
    expect(swipeProgress(100, 0)).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';

import { assertNever } from './assert-never.js';

describe('assertNever', () => {
  it('lanza un error que incluye el valor inesperado', () => {
    expect(() => assertNever('x' as never)).toThrow('Valor inesperado: "x"');
  });

  it('permite comprobar la exhaustividad de una unión', () => {
    type Color = 'red' | 'blue';
    const name = (color: Color): string => {
      switch (color) {
        case 'red':
          return 'rojo';
        case 'blue':
          return 'azul';
        default:
          return assertNever(color);
      }
    };

    expect(name('red')).toBe('rojo');
    expect(name('blue')).toBe('azul');
  });
});

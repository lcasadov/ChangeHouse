import { describe, expect, it } from 'vitest';

import { themeToCssVariables } from './css.js';
import { themes } from './theme.js';

describe('themeToCssVariables', () => {
  const light = themeToCssVariables(themes.light);
  const dark = themeToCssVariables(themes.dark);

  it('genera las mismas variables en ambos temas', () => {
    expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
  });

  it('convierte los nombres de token a kebab-case', () => {
    expect(light['--color-bg']).toBe('#FFFFFF');
    expect(light['--color-text-on-primary']).toBe('#FFFFFF');
    expect(dark['--color-compensation-receive']).toBe('#4ADE80');
    expect(dark['--color-photo-scrim-end']).toBe('rgba(0,0,0,0.72)');
  });

  it('incluye tipografía con unidades y la familia con respaldo', () => {
    expect(light['--font-title-size']).toBe('24px');
    expect(light['--font-title-line-height']).toBe('32px');
    expect(light['--font-body-strong-weight']).toBe('600');
    expect(light['--font-family']).toMatch(/^Inter, system-ui/);
  });

  it('incluye espaciado, radios, movimiento y elevación', () => {
    expect(light['--space-4']).toBe('16px');
    expect(light['--radius-lg']).toBe('20px');
    expect(light['--motion-base']).toBe('200ms');
    expect(light['--elevation-1-shadow']).toMatch(/^0 1px 3px/);
    expect(dark['--elevation-1-shadow']).toBe('none');
    expect(dark['--elevation-1-border-width']).toBe('1px');
  });

  it('incluye objetivo táctil, grosores, anchos máximos y opacidad', () => {
    expect(light['--touch-target']).toBe('44px');
    expect(light['--border-thick']).toBe('2px');
    expect(light['--content-max-reading']).toBe('720px');
    expect(light['--disabled-opacity']).toBe('0.5');
  });
});

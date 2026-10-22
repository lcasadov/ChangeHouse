import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { ThemeName, ThemePreference } from './theme.js';
import { ThemeProvider, useTheme } from './theme-provider.js';

function Probe() {
  const theme = useTheme();
  return <span data-bg={theme.color.bg}>{theme.name}</span>;
}

function render(scheme?: ThemeName | null, override?: ThemePreference): string {
  return renderToStaticMarkup(
    <ThemeProvider colorScheme={scheme} {...(override ? { override } : {})}>
      <Probe />
    </ThemeProvider>,
  );
}

describe('ThemeProvider', () => {
  it('sigue el esquema del sistema', () => {
    expect(render('dark')).toBe('<span data-bg="#121826">dark</span>');
    expect(render('light')).toBe('<span data-bg="#FFFFFF">light</span>');
  });

  it('usa el tema claro cuando el sistema no informa esquema', () => {
    expect(render(null)).toContain('>light<');
    expect(render(undefined, 'system')).toContain('>light<');
  });

  it('el override fuerza el tema ignorando el sistema', () => {
    expect(render('dark', 'light')).toContain('>light<');
    expect(render('light', 'dark')).toContain('>dark<');
  });
});

describe('useTheme', () => {
  it('falla con un mensaje claro fuera de un ThemeProvider', () => {
    expect(() => renderToStaticMarkup(<Probe />)).toThrow('ThemeProvider');
  });
});

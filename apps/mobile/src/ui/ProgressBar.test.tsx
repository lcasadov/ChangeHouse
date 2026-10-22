import { themes } from '@changehouse/ui';
import { screen } from '@testing-library/react-native';

import { renderThemed, styleOf, THEME_NAMES } from '../test-utils';
import { ProgressBar } from './ProgressBar';

describe('ProgressBar', () => {
  it('expone un indicador de progreso con su valor y su texto', async () => {
    await renderThemed(<ProgressBar label="Paso 2 de 5" now={2} max={5} />);

    const bar = screen.getByRole('progressbar', { name: 'Paso 2 de 5' });
    expect(bar.props.accessibilityValue).toMatchObject({ min: 0, max: 5, now: 2 });
    expect(screen.getByText('Paso 2 de 5')).toBeTruthy();
  });

  it('rellena la proporción completada', async () => {
    await renderThemed(<ProgressBar label="Paso 2 de 5" now={2} max={5} />);

    expect(styleOf(screen.getByTestId('progress-fill')).width).toBe('40%');
  });

  it('no se sale de la barra con valores fuera de rango', async () => {
    const view = await renderThemed(<ProgressBar label="x" now={9} max={5} />);
    expect(styleOf(screen.getByTestId('progress-fill')).width).toBe('100%');

    await view.rerender(<ProgressBar label="x" now={-1} max={5} />);
    expect(styleOf(screen.getByTestId('progress-fill')).width).toBe('0%');
  });

  describe.each(THEME_NAMES)('tema %s', (name) => {
    it('usa los colores del tema', async () => {
      await renderThemed(<ProgressBar label="x" now={1} max={5} />, name);

      expect(styleOf(screen.getByTestId('progress-fill')).backgroundColor).toBe(
        themes[name].color.primary,
      );
      expect(styleOf(screen.getByTestId('progress-track')).backgroundColor).toBe(
        themes[name].color.surfaceMuted,
      );
    });
  });
});

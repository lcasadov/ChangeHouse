import { themes } from '@changehouse/ui';
import { screen } from '@testing-library/react-native';

import { renderThemed, styleOf, THEME_NAMES } from '../test-utils';
import { Badge, type BadgeTone } from './Badge';

const TONE_COLORS = {
  neutral: 'textMuted',
  info: 'secondary',
  success: 'success',
  warning: 'warning',
} as const satisfies Record<BadgeTone, keyof (typeof themes)['light']['color']>;
const TONES = Object.keys(TONE_COLORS) as BadgeTone[];

describe('Badge', () => {
  it('muestra texto e icono: el color nunca va solo', async () => {
    await renderThemed(<Badge tone="success" icon="checkmark-circle" label="Publicada" />);

    expect(screen.getByText('Publicada')).toBeTruthy();
    expect(JSON.stringify(screen.toJSON())).toContain('"checkmark-circle"');
  });

  it('el icono es decorativo: el nombre accesible es el texto', async () => {
    await renderThemed(<Badge tone="info" icon="time-outline" label="En revisión" />);

    expect(screen.getByText('En revisión')).toBeTruthy();
    expect(screen.getByTestId('badge-icon').props.accessible).toBe(false);
  });

  describe.each(THEME_NAMES)('tema %s', (name) => {
    it.each(TONES)('el tono %s usa colores del tema', async (tone) => {
      const { color } = themes[name];
      await renderThemed(<Badge tone={tone} icon="home" label="Estado" />, name);

      expect(styleOf(screen.getByText('Estado')).color).toBe(color[TONE_COLORS[tone]]);
    });
  });
});

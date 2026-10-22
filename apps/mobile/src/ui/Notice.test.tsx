import { themes } from '@changehouse/ui';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderThemed, THEME_NAMES } from '../test-utils';
import { Notice, type NoticeTone } from './Notice';

const TONE_COLORS = {
  info: 'secondary',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
} as const satisfies Record<NoticeTone, keyof (typeof themes)['light']['color']>;
const TONES = Object.keys(TONE_COLORS) as NoticeTone[];

describe('Notice', () => {
  it('se anuncia a los lectores de pantalla con su texto', async () => {
    await renderThemed(<Notice tone="info">Enlace enviado</Notice>);

    const notice = screen.getByRole('alert');
    expect(notice).toHaveTextContent('Enlace enviado');
    expect(notice.props.accessibilityLiveRegion).toBe('polite');
  });

  it('ofrece la acción siguiente cuando se indica', async () => {
    const onPress = jest.fn();
    await renderThemed(
      <Notice tone="warning" action={{ label: 'Reenviar', onPress }}>
        Confirma tu email
      </Notice>,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Reenviar' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('no pinta acción si no se pide', async () => {
    await renderThemed(<Notice tone="info">Hola</Notice>);

    expect(screen.queryByRole('button')).toBeNull();
  });

  describe.each(THEME_NAMES)('tema %s', (name) => {
    it.each(TONES)(
      'el tono %s usa colores del tema y lleva icono además del color',
      async (tone) => {
        const { color } = themes[name];
        await renderThemed(<Notice tone={tone}>Texto</Notice>, name);

        const rendered = JSON.stringify(screen.toJSON());
        expect(rendered).toContain(color[TONE_COLORS[tone]]);
        expect(rendered).toContain('"Ionicons"');
      },
    );
  });
});

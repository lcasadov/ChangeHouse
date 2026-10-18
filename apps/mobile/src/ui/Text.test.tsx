import { themes } from '@changehouse/ui';
import { screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { renderThemed, styleOf } from '../test-utils';
import { Text } from './Text';

describe('Text', () => {
  it('aplica la tipografía del rol sin fijar fontWeight', async () => {
    await renderThemed(<Text variant="title">Hola</Text>);

    const style = styleOf(screen.getByText('Hola'));
    expect(style).toMatchObject({
      fontFamily: themes.light.font.title.family,
      fontSize: 24,
      lineHeight: 32,
    });
    expect(style).not.toHaveProperty('fontWeight');
  });

  it('usa body y el color de texto por defecto', async () => {
    await renderThemed(<Text>Cuerpo</Text>, 'dark');

    const style = styleOf(screen.getByText('Cuerpo'));
    expect(style).toMatchObject({ fontSize: 16, color: themes.dark.color.text });
  });

  it('acepta un tono y respeta el estilo recibido', async () => {
    await renderThemed(
      <Text tone="danger" style={{ textAlign: 'center' }}>
        Error
      </Text>,
    );

    expect(styleOf(screen.getByText('Error'))).toMatchObject({
      color: themes.light.color.danger,
      textAlign: 'center',
    });
  });

  it('en la web añade el respaldo de fuente del sistema', async () => {
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    try {
      await renderThemed(<Text>Web</Text>);
      const { fontFamily } = styleOf(screen.getByText('Web'));
      expect(fontFamily).toMatch(/^Inter_400Regular, system-ui/);
    } finally {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: original });
    }
  });
});

import { themes } from '@changehouse/ui';
import { fireEvent, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { renderThemed, styleOf } from '../test-utils';
import { Link } from './Link';

describe('Link', () => {
  beforeEach(() => {
    // Linking ya es un jest.fn en el entorno de React Native: restaurar no borra sus llamadas
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('es un enlace con nombre accesible y abre su dirección al pulsarlo', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await renderThemed(<Link label="Leer los términos" href="https://changehouse.test/terminos" />);

    await fireEvent.press(screen.getByRole('link', { name: 'Leer los términos' }));

    expect(open).toHaveBeenCalledWith('https://changehouse.test/terminos');
  });

  it('con onPress navega dentro de la app en lugar de abrir una dirección', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const onPress = jest.fn();
    await renderThemed(<Link label="Recuperar" onPress={onPress} />);

    await fireEvent.press(screen.getByRole('link', { name: 'Recuperar' }));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(open).not.toHaveBeenCalled();
  });

  it('no rompe la app si el sistema no puede abrir la dirección', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('sin navegador'));
    await renderThemed(<Link label="Leer" href="https://changehouse.test/x" />);

    await fireEvent.press(screen.getByRole('link', { name: 'Leer' }));

    expect(screen.getByRole('link', { name: 'Leer' })).toBeTruthy();
  });

  it('cumple el objetivo táctil, va subrayado (no solo color) y muestra el foco', async () => {
    await renderThemed(<Link label="Leer" href="https://changehouse.test/x" />, 'dark');
    const link = screen.getByRole('link');

    expect(styleOf(link)).toMatchObject({ minHeight: 44 });
    expect(styleOf(screen.getByText('Leer'))).toMatchObject({
      color: themes.dark.color.primary,
      textDecorationLine: 'underline',
    });
    await fireEvent(link, 'focus');
    expect(styleOf(screen.getByRole('link'))).toMatchObject({
      outlineColor: themes.dark.color.focus,
    });
    await fireEvent(link, 'blur');
    expect(styleOf(screen.getByRole('link'))).not.toHaveProperty('outlineColor');
  });
});

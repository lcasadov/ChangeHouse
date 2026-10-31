import { themes, touchTarget } from '@changehouse/ui';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderThemed, styleOf, THEME_NAMES } from '../test-utils';
import { BackButton } from './BackButton';

describe('BackButton', () => {
  it('es un botón con nombre accesible que llama a onPress', async () => {
    const onPress = jest.fn();
    await renderThemed(<BackButton label="Volver al match" onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Volver al match' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('cumple el tamaño mínimo del objetivo táctil', async () => {
    await renderThemed(<BackButton label="Volver" onPress={jest.fn()} />);

    const style = styleOf(screen.getByRole('button', { name: 'Volver' }));

    expect(style.minHeight).toBe(touchTarget);
    expect(style.minWidth).toBe(touchTarget);
  });

  it.each(THEME_NAMES)('pinta el icono con el color de texto del tema %s', async (theme) => {
    await renderThemed(<BackButton label="Volver" onPress={jest.fn()} />, theme);

    expect(JSON.stringify(screen.toJSON())).toContain(`"color":"${themes[theme].color.text}"`);
  });
});

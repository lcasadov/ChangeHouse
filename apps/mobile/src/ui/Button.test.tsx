import { themes } from '@changehouse/ui';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderThemed, styleOf, THEME_NAMES } from '../test-utils';
import { Button, type ButtonVariant } from './Button';

const VARIANTS: readonly ButtonVariant[] = ['primary', 'secondary', 'ghost', 'danger'];

describe('Button', () => {
  it('expone rol de botón y nombre accesible, y dispara onPress', async () => {
    const onPress = jest.fn();
    await renderThemed(<Button label="Guardar" onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('permite una etiqueta accesible distinta del texto visible', async () => {
    await renderThemed(
      <Button label="OK" accessibilityLabel="Confirmar cambio" onPress={jest.fn()} />,
    );

    expect(screen.getByRole('button', { name: 'Confirmar cambio' })).toBeTruthy();
  });

  it('cargando bloquea la doble pulsación, se anuncia ocupado y conserva el texto', async () => {
    const onPress = jest.fn();
    const view = await renderThemed(<Button label="Enviar" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar' }));

    await view.rerender(<Button label="Enviar" onPress={onPress} loading />);
    const button = screen.getByRole('button', { name: 'Enviar' });
    await fireEvent.press(button);
    await fireEvent.press(button);

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(button.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    expect(screen.getByText('Enviar')).toBeTruthy();
  });

  it('deshabilitado no dispara onPress', async () => {
    const onPress = jest.fn();
    await renderThemed(<Button label="Enviar" onPress={onPress} disabled />);

    await fireEvent.press(screen.getByRole('button', { name: 'Enviar' }));

    expect(onPress).not.toHaveBeenCalled();
  });

  it('cumple el objetivo táctil mínimo de 44 × 44', async () => {
    await renderThemed(<Button label="Ir" onPress={jest.fn()} />);

    const style = styleOf(screen.getByRole('button'));
    expect(style).toMatchObject({ minHeight: 44, minWidth: 44 });
  });

  it('muestra el anillo de foco con el token de foco al recibir foco', async () => {
    await renderThemed(<Button label="Ir" onPress={jest.fn()} />, 'dark');
    const button = screen.getByRole('button');

    await fireEvent(button, 'focus');
    expect(styleOf(screen.getByRole('button'))).toMatchObject({
      outlineColor: themes.dark.color.focus,
    });

    await fireEvent(button, 'blur');
    expect(styleOf(screen.getByRole('button'))).not.toHaveProperty('outlineColor');
  });

  describe.each(THEME_NAMES)('tema %s', (name) => {
    it.each(VARIANTS)('la variante %s usa solo colores del tema', async (variant) => {
      const { color, radius } = themes[name];
      await renderThemed(<Button label="Ir" variant={variant} onPress={jest.fn()} />, name);

      const style = styleOf(screen.getByRole('button'));
      const label = styleOf(screen.getByText('Ir'));

      expect(style.borderRadius).toBe(radius.md);
      expect(Object.values(color)).toContain(label.color);
      if (variant === 'primary') {
        expect(style.backgroundColor).toBe(color.primary);
        expect(label.color).toBe(color.textOnPrimary);
      }
      if (variant === 'danger') expect(style.backgroundColor).toBe(color.danger);
      if (variant === 'secondary') expect(style.borderColor).toBe(color.primary);
    });
  });
});

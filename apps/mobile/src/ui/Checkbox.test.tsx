import { themes } from '@changehouse/ui';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderThemed, styleOf, THEME_NAMES } from '../test-utils';
import { Checkbox } from './Checkbox';

describe('Checkbox', () => {
  it('expone rol, nombre y estado, y pide el valor contrario al pulsarla', async () => {
    const onChange = jest.fn();
    const view = await renderThemed(
      <Checkbox label="Acepto" checked={false} onChange={onChange} />,
    );
    const box = screen.getByRole('checkbox', { name: 'Acepto' });
    expect(box.props.accessibilityState).toMatchObject({ checked: false });

    await fireEvent.press(box);
    expect(onChange).toHaveBeenLastCalledWith(true);

    await view.rerender(<Checkbox label="Acepto" checked onChange={onChange} />);
    const checked = screen.getByRole('checkbox', { name: 'Acepto' });
    expect(checked.props.accessibilityState).toMatchObject({ checked: true });
    await fireEvent.press(checked);
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it('muestra el error junto a la casilla y lo anuncia', async () => {
    await renderThemed(
      <Checkbox label="Acepto" checked={false} onChange={jest.fn()} error="Falta aceptar" />,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Falta aceptar');
    expect(alert.props.accessibilityLiveRegion).toBe('polite');
  });

  it('cumple el objetivo táctil mínimo de 44 × 44', async () => {
    await renderThemed(<Checkbox label="Acepto" checked={false} onChange={jest.fn()} />);

    expect(styleOf(screen.getByRole('checkbox'))).toMatchObject({ minHeight: 44, minWidth: 44 });
  });

  it('muestra el anillo de foco al recibir foco', async () => {
    await renderThemed(<Checkbox label="Acepto" checked={false} onChange={jest.fn()} />, 'dark');
    const box = screen.getByRole('checkbox');

    await fireEvent(box, 'focus');
    expect(styleOf(screen.getByRole('checkbox'))).toMatchObject({
      outlineColor: themes.dark.color.focus,
    });
    await fireEvent(box, 'blur');
    expect(styleOf(screen.getByRole('checkbox'))).not.toHaveProperty('outlineColor');
  });

  describe.each(THEME_NAMES)('tema %s', (name) => {
    it('la casilla marcada usa el color primario y el error el de peligro', async () => {
      const { color } = themes[name];
      await renderThemed(
        <Checkbox label="Acepto" checked onChange={jest.fn()} error="Mal" />,
        name,
      );

      expect(JSON.stringify(screen.toJSON())).toContain(color.primary);
      expect(styleOf(screen.getByText('Mal')).color).toBe(color.danger);
    });
  });
});

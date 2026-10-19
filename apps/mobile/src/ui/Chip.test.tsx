import { themes } from '@changehouse/ui';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderThemed, styleOf, THEME_NAMES } from '../test-utils';
import { Chip } from './Chip';

describe('Chip', () => {
  it('expone rol de casilla, nombre y estado, y pide el valor contrario al pulsarlo', async () => {
    const onChange = jest.fn();
    const view = await renderThemed(<Chip label="Terraza" selected={false} onChange={onChange} />);
    const chip = screen.getByRole('checkbox', { name: 'Terraza' });
    expect(chip.props.accessibilityState).toMatchObject({ checked: false });

    await fireEvent.press(chip);
    expect(onChange).toHaveBeenLastCalledWith(true);

    await view.rerender(<Chip label="Terraza" selected onChange={onChange} />);
    const selected = screen.getByRole('checkbox', { name: 'Terraza' });
    expect(selected.props.accessibilityState).toMatchObject({ checked: true });
    await fireEvent.press(selected);
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it('con rol de opción expone una opción de un grupo y siempre pide elegirla', async () => {
    const onChange = jest.fn();
    await renderThemed(<Chip label="Piso" selected kind="radio" onChange={onChange} />);

    const chip = screen.getByRole('radio', { name: 'Piso' });
    expect(chip.props.accessibilityState).toMatchObject({ checked: true });
    await fireEvent.press(chip);
    expect(onChange).toHaveBeenLastCalledWith(true);
  });

  it('el elegido lleva una marca además del color', async () => {
    await renderThemed(<Chip label="Terraza" selected onChange={jest.fn()} />);

    expect(JSON.stringify(screen.toJSON())).toContain('"checkmark"');
  });

  it('cumple el objetivo táctil mínimo de 44 × 44', async () => {
    await renderThemed(<Chip label="Terraza" selected={false} onChange={jest.fn()} />);

    expect(styleOf(screen.getByRole('checkbox'))).toMatchObject({ minHeight: 44, minWidth: 44 });
  });

  it('muestra el anillo de foco al recibir foco', async () => {
    await renderThemed(<Chip label="Terraza" selected={false} onChange={jest.fn()} />, 'dark');
    const chip = screen.getByRole('checkbox');

    await fireEvent(chip, 'focus');
    expect(styleOf(screen.getByRole('checkbox'))).toMatchObject({
      outlineColor: themes.dark.color.focus,
    });
    await fireEvent(chip, 'blur');
    expect(styleOf(screen.getByRole('checkbox'))).not.toHaveProperty('outlineColor');
  });

  describe.each(THEME_NAMES)('tema %s', (name) => {
    it('el chip elegido usa el color primario del tema', async () => {
      await renderThemed(<Chip label="Terraza" selected onChange={jest.fn()} />, name);

      expect(styleOf(screen.getByRole('checkbox')).backgroundColor).toBe(
        themes[name].color.primary,
      );
    });
  });
});

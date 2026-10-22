import { themes } from '@changehouse/ui';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderThemed, styleOf, THEME_NAMES } from '../test-utils';
import { Switch } from './Switch';

const LABEL = 'Compartir mi teléfono';

describe('Switch', () => {
  it('expone rol, nombre y estado, y pide el valor contrario al pulsarlo', async () => {
    const onChange = jest.fn();
    const view = await renderThemed(<Switch label={LABEL} checked={false} onChange={onChange} />);
    const control = screen.getByRole('switch', { name: LABEL });
    expect(control.props.accessibilityState).toMatchObject({ checked: false });

    await fireEvent.press(control);
    expect(onChange).toHaveBeenLastCalledWith(true);

    await view.rerender(<Switch label={LABEL} checked onChange={onChange} />);
    const checked = screen.getByRole('switch', { name: LABEL });
    expect(checked.props.accessibilityState).toMatchObject({ checked: true });
    await fireEvent.press(checked);
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it('muestra la descripción y la ofrece como ayuda del control', async () => {
    await renderThemed(
      <Switch
        label={LABEL}
        description="Lo verán los demás"
        checked={false}
        onChange={jest.fn()}
      />,
    );

    expect(screen.getByText('Lo verán los demás')).toBeTruthy();
    expect(screen.getByRole('switch', { name: LABEL }).props.accessibilityHint).toBe(
      'Lo verán los demás',
    );
  });

  it('deshabilitado ignora las pulsaciones y lo dice a los lectores de pantalla', async () => {
    const onChange = jest.fn();
    await renderThemed(<Switch label={LABEL} checked={false} onChange={onChange} disabled />);
    const control = screen.getByRole('switch', { name: LABEL });

    await fireEvent.press(control);

    expect(onChange).not.toHaveBeenCalled();
    expect(control.props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('cumple el objetivo táctil mínimo de 44 × 44', async () => {
    await renderThemed(<Switch label={LABEL} checked={false} onChange={jest.fn()} />);

    expect(styleOf(screen.getByRole('switch'))).toMatchObject({ minHeight: 44, minWidth: 44 });
  });

  it('muestra el anillo de foco al recibir foco', async () => {
    await renderThemed(<Switch label={LABEL} checked={false} onChange={jest.fn()} />, 'dark');
    const control = screen.getByRole('switch');

    await fireEvent(control, 'focus');
    expect(styleOf(screen.getByRole('switch'))).toMatchObject({
      outlineColor: themes.dark.color.focus,
    });
    await fireEvent(control, 'blur');
    expect(styleOf(screen.getByRole('switch')).outlineColor).toBeUndefined();
  });

  it.each(THEME_NAMES)('usa los tokens del tema %s para la pista y el pulgar', async (theme) => {
    const view = await renderThemed(
      <Switch label={LABEL} checked={false} onChange={jest.fn()} />,
      theme,
    );
    expect(styleOf(screen.getByTestId('switch-track')).backgroundColor).toBe(
      themes[theme].color.surfaceMuted,
    );
    expect(styleOf(screen.getByTestId('switch-track')).borderColor).toBe(
      themes[theme].color.borderStrong,
    );

    await view.rerender(<Switch label={LABEL} checked onChange={jest.fn()} />);
    expect(styleOf(screen.getByTestId('switch-track')).backgroundColor).toBe(
      themes[theme].color.primary,
    );
    expect(styleOf(screen.getByTestId('switch-thumb')).backgroundColor).toBe(
      themes[theme].color.surface,
    );
  });

  it('desplaza el pulgar hacia el extremo al activarse', async () => {
    const view = await renderThemed(<Switch label={LABEL} checked={false} onChange={jest.fn()} />);
    const off = styleOf(screen.getByTestId('switch-thumb')).alignSelf;

    await view.rerender(<Switch label={LABEL} checked onChange={jest.fn()} />);

    expect(off).toBe('flex-start');
    expect(styleOf(screen.getByTestId('switch-thumb')).alignSelf).toBe('flex-end');
  });
});

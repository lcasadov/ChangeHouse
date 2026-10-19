import { fireEvent, screen } from '@testing-library/react-native';

import { renderThemed, THEME_NAMES } from '../test-utils';
import { ChoiceChips } from './ChoiceChips';

const OPTIONS = [
  { value: 'area', label: 'Solo el barrio' },
  { value: 'exact', label: 'La ubicación exacta' },
] as const;

describe('ChoiceChips', () => {
  it('agrupa las opciones con la etiqueta del grupo y marca la elegida', async () => {
    await renderThemed(
      <ChoiceChips label="Ubicación" options={OPTIONS} value="area" onChange={jest.fn()} />,
    );

    // El grupo no es `accessible` (agruparía a sus opciones y las haría inalcanzables en iOS)
    expect(screen.getByLabelText('Ubicación').props.accessibilityRole).toBe('radiogroup');
    expect(screen.getByText('Ubicación')).toBeTruthy();
    expect(
      screen.getByRole('radio', { name: 'Solo el barrio' }).props.accessibilityState,
    ).toMatchObject({ checked: true });
    expect(
      screen.getByRole('radio', { name: 'La ubicación exacta' }).props.accessibilityState,
    ).toMatchObject({ checked: false });
  });

  it('pide el valor de la opción pulsada', async () => {
    const onChange = jest.fn();
    await renderThemed(
      <ChoiceChips label="Ubicación" options={OPTIONS} value="area" onChange={onChange} />,
    );

    await fireEvent.press(screen.getByRole('radio', { name: 'La ubicación exacta' }));

    expect(onChange).toHaveBeenCalledWith('exact');
  });

  it('en una elección opcional, pulsar la elegida la deselecciona', async () => {
    const onChange = jest.fn();
    const onClear = jest.fn();
    await renderThemed(
      <ChoiceChips
        label="Ubicación"
        options={OPTIONS}
        value="area"
        onChange={onChange}
        onClear={onClear}
      />,
    );

    await fireEvent.press(screen.getByRole('radio', { name: 'Solo el barrio' }));
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('radio', { name: 'La ubicación exacta' }));
    expect(onChange).toHaveBeenCalledWith('exact');
  });

  it('sin elección ninguna opción está marcada', async () => {
    await renderThemed(
      <ChoiceChips label="Ubicación" options={OPTIONS} value="" onChange={jest.fn()} />,
    );

    for (const radio of screen.getAllByRole('radio')) {
      expect(radio.props.accessibilityState).toMatchObject({ checked: false });
    }
  });

  it('muestra el error junto al grupo y lo anuncia', async () => {
    await renderThemed(
      <ChoiceChips
        label="Ubicación"
        options={OPTIONS}
        value=""
        onChange={jest.fn()}
        error="Elige una opción"
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Elige una opción');
  });

  it.each(THEME_NAMES)('se renderiza en el tema %s', async (name) => {
    await renderThemed(
      <ChoiceChips label="Ubicación" options={OPTIONS} value="exact" onChange={jest.fn()} />,
      name,
    );

    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });
});

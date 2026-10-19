import { themes } from '@changehouse/ui';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderThemed, styleOf, THEME_NAMES } from '../test-utils';
import { TextField } from './TextField';

describe('TextField', () => {
  it('asocia la etiqueta al campo y entrega lo que se escribe', async () => {
    const onChangeText = jest.fn();
    await renderThemed(<TextField label="Email" value="" onChangeText={onChangeText} />);

    await fireEvent.changeText(screen.getByLabelText('Email'), 'ana@example.com');

    expect(screen.getByText('Email')).toBeTruthy();
    expect(onChangeText).toHaveBeenCalledWith('ana@example.com');
  });

  it('muestra la pista bajo el campo', async () => {
    await renderThemed(
      <TextField label="Contraseña" value="" onChangeText={jest.fn()} hint="Mínimo 8 caracteres" />,
    );

    expect(screen.getByText('Mínimo 8 caracteres')).toBeTruthy();
  });

  it('el error se muestra junto al campo, se anuncia y deja el campo marcado como no válido', async () => {
    await renderThemed(
      <TextField label="Email" value="x" onChangeText={jest.fn()} error="Revisa el email" />,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Revisa el email');
    expect(alert.props.accessibilityLiveRegion).toBe('polite');
    const input = screen.getByLabelText('Email');
    expect(input.props['aria-invalid']).toBe(true);
    expect(input.props.accessibilityHint).toBe('Revisa el email');
  });

  it('sin error no hay aviso ni marca de no válido', async () => {
    await renderThemed(<TextField label="Email" value="" onChangeText={jest.fn()} />);

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByLabelText('Email').props['aria-invalid']).toBe(false);
  });

  it('avisa al salir del campo', async () => {
    const onBlur = jest.fn();
    await renderThemed(
      <TextField label="Email" value="" onChangeText={jest.fn()} onBlur={onBlur} />,
    );
    const input = screen.getByLabelText('Email');

    await fireEvent(input, 'focus');
    await fireEvent(input, 'blur');

    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('cumple el objetivo táctil mínimo de 44', async () => {
    await renderThemed(<TextField label="Email" value="" onChangeText={jest.fn()} />);

    expect(styleOf(screen.getByLabelText('Email'))).toMatchObject({ minHeight: 44 });
  });

  it('oculta lo escrito en los campos secretos', async () => {
    await renderThemed(<TextField label="Contraseña" value="x" onChangeText={jest.fn()} secret />);

    expect(screen.getByLabelText('Contraseña').props.secureTextEntry).toBe(true);
  });

  describe.each(THEME_NAMES)('tema %s', (name) => {
    it('usa los tokens de color para borde, foco y error', async () => {
      const { color } = themes[name];
      const view = await renderThemed(
        <TextField label="Email" value="" onChangeText={jest.fn()} />,
        name,
      );
      const input = screen.getByLabelText('Email');
      expect(styleOf(input)).toMatchObject({ borderColor: color.borderStrong, color: color.text });

      await fireEvent(input, 'focus');
      expect(styleOf(screen.getByLabelText('Email'))).toMatchObject({ outlineColor: color.focus });

      await view.rerender(
        <TextField label="Email" value="" onChangeText={jest.fn()} error="Mal" />,
      );
      expect(styleOf(screen.getByLabelText('Email')).borderColor).toBe(color.danger);
      expect(styleOf(screen.getByText('Mal')).color).toBe(color.danger);
    });
  });
});

import { themes } from '@changehouse/ui';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderThemed, THEME_NAMES } from '../test-utils';
import { Dialog } from './Dialog';

function setup(visible = true) {
  const onConfirm = jest.fn();
  const onCancel = jest.fn();
  const view = (
    <Dialog
      visible={visible}
      title="¿Cerrar sesión?"
      description="Tendrás que volver a identificarte."
      confirmLabel="Sí, cerrar"
      cancelLabel="Cancelar"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
  return { onConfirm, onCancel, view };
}

describe('Dialog', () => {
  it('no pinta nada mientras no es visible', async () => {
    await renderThemed(setup(false).view);

    expect(screen.queryByText('¿Cerrar sesión?')).toBeNull();
  });

  it('es un diálogo modal con título, descripción y las dos acciones', async () => {
    await renderThemed(setup().view);

    const dialog = screen.getByLabelText('¿Cerrar sesión?');
    expect(dialog.props.role).toBe('alertdialog');
    expect(dialog.props['aria-modal']).toBe(true);
    expect(dialog.props.accessibilityViewIsModal).toBe(true);
    expect(screen.getByRole('header', { name: '¿Cerrar sesión?' })).toBeTruthy();
    expect(screen.getByText('Tendrás que volver a identificarte.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sí, cerrar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeTruthy();
  });

  it('confirmar y cancelar llaman cada uno a su acción', async () => {
    const { view, onConfirm, onCancel } = setup();
    await renderThemed(view);

    await fireEvent.press(screen.getByRole('button', { name: 'Sí, cerrar' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('la tecla Escape o el gesto de volver cancelan', async () => {
    const { view, onCancel, onConfirm } = setup();
    await renderThemed(view);

    await fireEvent(screen.getByLabelText('¿Cerrar sesión?'), 'requestClose');

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  describe.each(THEME_NAMES)('tema %s', (name) => {
    it('usa el velo y la superficie elevada del tema', async () => {
      const { color, elevation } = themes[name];
      await renderThemed(setup().view, name);

      const rendered = JSON.stringify(screen.toJSON());
      expect(rendered).toContain(color.overlay);
      expect(rendered).toContain(elevation[3].surface);
    });
  });
});

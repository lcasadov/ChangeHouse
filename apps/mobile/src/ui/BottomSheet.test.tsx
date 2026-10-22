import { themes } from '@changehouse/ui';
import { fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { renderThemed, styleOf, THEME_NAMES } from '../test-utils';
import { BottomSheet } from './BottomSheet';

function sheet(overrides: Partial<Parameters<typeof BottomSheet>[0]> = {}) {
  return (
    <BottomSheet visible title="Filtros" closeLabel="Cerrar" onClose={jest.fn()} {...overrides}>
      <Text>Contenido</Text>
    </BottomSheet>
  );
}

describe('BottomSheet', () => {
  it('muestra el título como encabezado, el contenido y un botón de cerrar con nombre', async () => {
    const onClose = jest.fn();
    await renderThemed(sheet({ onClose }));

    expect(screen.getByRole('header', { name: 'Filtros' })).toBeTruthy();
    expect(screen.getByText('Contenido')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('es un diálogo modal: el resto de la pantalla queda fuera del alcance de los lectores', async () => {
    await renderThemed(sheet());

    const dialog = screen.getByLabelText('Filtros', { exact: true, includeHiddenElements: true });
    expect(dialog.props.accessibilityViewIsModal).toBe(true);
  });

  it('cerrado no muestra nada', async () => {
    await renderThemed(sheet({ visible: false }));

    expect(screen.queryByText('Contenido')).toBeNull();
  });

  it('el gesto de volver lo cierra', async () => {
    const onClose = jest.fn();
    await renderThemed(sheet({ onClose }));

    await fireEvent(
      screen.getByLabelText('Filtros', { includeHiddenElements: true }),
      'requestClose',
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it.each(THEME_NAMES)('en el tema %s la hoja usa la superficie elevada del tema', async (name) => {
    await renderThemed(sheet(), name);

    const panel = screen.getByLabelText('Filtros', { includeHiddenElements: true });
    expect(styleOf(panel).backgroundColor).toBe(themes[name].elevation[3].surface);
  });
});

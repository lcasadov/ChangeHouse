import { themes } from '@changehouse/ui';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderThemed, styleOf, THEME_NAMES } from '../test-utils';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('muestra título (como encabezado) y descripción', async () => {
    await renderThemed(
      <EmptyState title="Sin matches" description="Aquí aparecerán tus matches." />,
    );

    expect(screen.getByRole('header', { name: 'Sin matches' })).toBeTruthy();
    expect(screen.getByText('Aquí aparecerán tus matches.')).toBeTruthy();
  });

  it('no pinta acción si no se pide', async () => {
    await renderThemed(<EmptyState title="Vacío" description="Nada" />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('ofrece la acción siguiente cuando se indica', async () => {
    const onPress = jest.fn();
    await renderThemed(
      <EmptyState
        icon="home-outline"
        title="Sin casas"
        description="Publica la primera"
        action={{ label: 'Publicar casa', onPress }}
      />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Publicar casa' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it.each(THEME_NAMES)('en el tema %s los textos usan los tokens de color', async (name) => {
    await renderThemed(<EmptyState title="Título" description="Descripción" />, name);

    expect(styleOf(screen.getByText('Título')).color).toBe(themes[name].color.text);
    expect(styleOf(screen.getByText('Descripción')).color).toBe(themes[name].color.textMuted);
  });
});

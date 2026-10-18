import { renderRouter, screen } from 'expo-router/testing-library';

import RootLayout from '../../app/_layout';
import IndexScreen from '../../app/index';
import { PLACEHOLDER_TEXT } from '../placeholder';

describe('rutas de la app', () => {
  it('la ruta raíz muestra el texto provisional dentro del layout', async () => {
    const view = await renderRouter({ _layout: RootLayout, index: IndexScreen });

    expect(await screen.findByText(PLACEHOLDER_TEXT)).toBeTruthy();
    expect(view.getPathname()).toBe('/');
  });
});

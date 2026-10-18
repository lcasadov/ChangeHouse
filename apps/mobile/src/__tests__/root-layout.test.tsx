import { renderRouter, screen } from 'expo-router/testing-library';
import * as SplashScreen from 'expo-splash-screen';
import { Text } from 'react-native';

import RootLayout from '../../app/_layout';
import { useAppFonts } from '../fonts/use-app-fonts';

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}));
jest.mock('../fonts/use-app-fonts', () => ({ useAppFonts: jest.fn() }));
jest.mock('../observability/sentry', () => ({ initSentry: jest.fn() }));

const ROUTES = {
  _layout: RootLayout,
  index: () => <Text>contenido</Text>,
};

describe('layout raíz', () => {
  beforeEach(() => {
    jest.mocked(SplashScreen.hideAsync).mockClear();
  });

  it('mantiene el splash y no pinta nada mientras Inter se carga', async () => {
    jest.mocked(useAppFonts).mockReturnValue({ ready: false, failed: false });
    await renderRouter(ROUTES);

    expect(screen.queryByText('contenido')).toBeNull();
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
  });

  it('oculta el splash y pinta la app cuando las fuentes están listas', async () => {
    jest.mocked(useAppFonts).mockReturnValue({ ready: true, failed: false });
    await renderRouter(ROUTES);

    expect(await screen.findByText('contenido')).toBeTruthy();
    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
  });

  it('oculta el splash también si la carga de fuentes falla (respaldo del sistema)', async () => {
    jest.mocked(useAppFonts).mockReturnValue({ ready: true, failed: true });
    await renderRouter(ROUTES);

    expect(await screen.findByText('contenido')).toBeTruthy();
    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
  });
});

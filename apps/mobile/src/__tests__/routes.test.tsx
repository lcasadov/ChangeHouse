import type { ThemePreference } from '@changehouse/ui';
import { themes } from '@changehouse/ui';
import { fireEvent } from '@testing-library/react-native';
import { Slot } from 'expo-router';
import { renderRouter, screen } from 'expo-router/testing-library';

import TabsLayout from '../../app/(tabs)/_layout';
import HomesScreen from '../../app/(tabs)/homes';
import ExploreScreen from '../../app/(tabs)/index';
import MatchesScreen from '../../app/(tabs)/matches';
import ProfileScreen from '../../app/(tabs)/profile';
import { SessionProviders } from '../features/session/SessionProviders';
import * as tabsModule from '../features/shell/tabs';
import es from '../i18n/locales/es-ES.json';
import { fakeServices } from '../test-support/render-session-app';
import { styleOf } from '../test-utils';
import { AppThemeProvider } from '../theme/AppThemeProvider';

let themeOverride: ThemePreference = 'system';

// La pestaña Perfil ofrece cerrar sesión, así que necesita la sesión (aquí, una persona ya dada de alta)
const services = fakeServices();

function TestRoot() {
  return (
    <AppThemeProvider override={themeOverride}>
      <SessionProviders services={services}>
        <Slot />
      </SessionProviders>
    </AppThemeProvider>
  );
}

const ROUTES = {
  _layout: TestRoot,
  '(tabs)/_layout': TabsLayout,
  '(tabs)/index': ExploreScreen,
  '(tabs)/matches': MatchesScreen,
  '(tabs)/homes': HomesScreen,
  '(tabs)/profile': ProfileScreen,
};

const TAB_CASES = [
  [es.tabs.explore, '/', es.explore.empty.title],
  [es.tabs.matches, '/matches', es.matches.empty.title],
  [es.tabs.homes, '/homes', es.homes.empty.title],
  [es.tabs.profile, '/profile', es.profile.empty.title],
] as const;

describe('navegación principal', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    themeOverride = 'system';
  });

  it('muestra las cuatro pestañas con sus etiquetas de i18n y la de Explorar activa', async () => {
    await renderRouter(ROUTES);

    for (const [label] of TAB_CASES) {
      expect(await screen.findByRole('button', { name: label })).toBeTruthy();
    }
    expect(screen.getByText(es.explore.empty.title)).toBeTruthy();
  });

  it.each(TAB_CASES)(
    'al pulsar «%s» navega a %s y muestra su estado vacío',
    async (label, path, title) => {
      const view = await renderRouter(ROUTES);

      await fireEvent.press(await screen.findByRole('button', { name: label }));

      expect(view.getPathname()).toBe(path);
      expect(await screen.findByRole('header', { name: title })).toBeTruthy();
    },
  );

  it.each(['light', 'dark'] as const)(
    'en el tema %s la barra de pestañas usa los tokens del tema',
    async (scheme) => {
      themeOverride = scheme;
      await renderRouter(ROUTES);

      const tab = await screen.findByRole('button', { name: es.tabs.explore });
      const title = screen.getByText(es.explore.empty.title);

      expect(styleOf(title).color).toBe(themes[scheme].color.text);
      expect(JSON.stringify(screen.toJSON())).toContain(themes[scheme].color.primary);
      expect(tab).toBeTruthy();
    },
  );

  it('en web ancha renderiza la navegación lateral con las mismas cuatro secciones', async () => {
    jest.spyOn(tabsModule, 'navigationLayoutFor').mockReturnValue('side');
    await renderRouter(ROUTES);

    for (const [label] of TAB_CASES) {
      expect(await screen.findByRole('button', { name: label })).toBeTruthy();
    }
    expect(screen.getByText(es.explore.empty.title)).toBeTruthy();
  });
});

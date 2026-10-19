import { fireEvent, screen } from '@testing-library/react-native';
import { Slot } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';

import es from '../../i18n/locales/es-ES.json';
import { me } from '../../test-support/fake-backend';
import { fakeServices } from '../../test-support/render-session-app';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { SessionProviders } from '../session/SessionProviders';
import { AccountApiError } from './account-api';
import { ProfileScreen } from './ProfileScreen';

const { profile } = es;

type GetMe = () => Promise<ReturnType<typeof me> | null>;

function renderProfile(getMe: GetMe) {
  const services = fakeServices({
    accountApi: { getMe, upsertMe: () => Promise.resolve(me()) },
  });
  function Root() {
    return (
      <AppThemeProvider override="light">
        <SessionProviders services={services}>
          <Slot />
        </SessionProviders>
      </AppThemeProvider>
    );
  }
  return renderRouter({ _layout: Root, index: ProfileScreen });
}

describe('ProfileScreen - carga del perfil', () => {
  it('si no se puede cargar el perfil lo explica y permite reintentar', async () => {
    const getMe = jest
      .fn<ReturnType<GetMe>, []>()
      .mockRejectedValueOnce(new AccountApiError('network'))
      .mockResolvedValue(me({ displayName: 'Lucía' }));
    await renderProfile(getMe);

    expect(await screen.findByText(profile.errors.loadFailed)).toBeTruthy();
    // Cerrar sesión sigue disponible aunque el perfil no cargue
    expect(screen.getByRole('button', { name: es.auth.signOut })).toBeTruthy();
    expect(screen.queryByLabelText(profile.form.displayName)).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: profile.errors.retry }));

    expect((await screen.findByLabelText(profile.form.displayName)).props.value).toBe('Lucía');
    expect(screen.queryByText(profile.errors.loadFailed)).toBeNull();
  });
});

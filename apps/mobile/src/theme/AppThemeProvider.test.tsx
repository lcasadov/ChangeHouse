import { useTheme } from '@changehouse/ui';
import { render, screen } from '@testing-library/react-native';
import { Text, useColorScheme } from 'react-native';

import { AppThemeProvider } from './AppThemeProvider';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockScheme = (scheme: 'light' | 'dark' | null) =>
  jest.mocked(useColorScheme).mockReturnValue(scheme);

function ThemeName() {
  return <Text>{useTheme().name}</Text>;
}

describe('AppThemeProvider', () => {
  it('sigue el esquema oscuro del sistema', async () => {
    mockScheme('dark');
    await render(
      <AppThemeProvider>
        <ThemeName />
      </AppThemeProvider>,
    );

    expect(screen.getByText('dark')).toBeTruthy();
  });

  it('sigue el esquema claro del sistema', async () => {
    mockScheme('light');
    await render(
      <AppThemeProvider>
        <ThemeName />
      </AppThemeProvider>,
    );

    expect(screen.getByText('light')).toBeTruthy();
  });

  it('el override fuerza el tema ignorando el sistema', async () => {
    mockScheme('dark');
    await render(
      <AppThemeProvider override="light">
        <ThemeName />
      </AppThemeProvider>,
    );

    expect(screen.getByText('light')).toBeTruthy();
  });

  it('usa el tema claro si el sistema no informa esquema', async () => {
    mockScheme(null);
    await render(
      <AppThemeProvider>
        <ThemeName />
      </AppThemeProvider>,
    );

    expect(screen.getByText('light')).toBeTruthy();
  });
});

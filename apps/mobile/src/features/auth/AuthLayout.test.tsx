import { screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { renderThemed, styleOf, THEME_NAMES } from '../../test-utils';
import type { Breakpoint } from '../../ui';
import { AuthLayout } from './AuthLayout';

let mockBreakpoint: Breakpoint = 'compact';
jest.mock('../../ui/useBreakpoint', () => ({
  ...jest.requireActual<object>('../../ui/useBreakpoint'),
  useBreakpoint: () => mockBreakpoint,
}));

describe('AuthLayout', () => {
  it.each(THEME_NAMES)(
    'en pantalla estrecha pone la foto en una franja superior (%s)',
    async (theme) => {
      mockBreakpoint = 'compact';
      await renderThemed(
        <AuthLayout>
          <Text>Formulario</Text>
        </AuthLayout>,
        theme,
      );

      const photo = screen.getByTestId('auth-photo', { includeHiddenElements: true });
      expect(photo.props.accessibilityElementsHidden).toBe(true);
      expect(styleOf(photo).height).toBeGreaterThan(0);
      expect(screen.getByText('Formulario')).toBeTruthy();
      expect(screen.queryByTestId('auth-split')).toBeNull();
    },
  );

  it('Scenario: Acceso en web ancha - el formulario en una columna y la foto en la otra', async () => {
    mockBreakpoint = 'expanded';
    await renderThemed(
      <AuthLayout>
        <Text>Formulario</Text>
      </AuthLayout>,
    );

    expect(styleOf(screen.getByTestId('auth-split')).flexDirection).toBe('row');
    expect(screen.getByTestId('auth-photo', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText('Formulario')).toBeTruthy();
  });
});

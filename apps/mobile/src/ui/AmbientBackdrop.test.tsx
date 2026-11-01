import { themes } from '@changehouse/ui';
import { act, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { animatedStyleOf, renderThemed, styleOf, THEME_NAMES } from '../test-utils';
import { AMBIENT } from './ambient';
import { AmbientBackdrop } from './AmbientBackdrop';

describe('AmbientBackdrop', () => {
  // `isReduceMotionEnabled` ya es un `jest.fn` de React Native: `restoreAllMocks` no deshace su valor
  beforeEach(() => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it.each(THEME_NAMES)('es decorativo y lleva el velo del tema %s', async (theme) => {
    await renderThemed(<AmbientBackdrop sources={AMBIENT.welcome} />, theme);

    const root = screen.getByTestId('ambient-backdrop', { includeHiddenElements: true });
    expect(root.props.accessibilityElementsHidden).toBe(true);
    expect(root.props.importantForAccessibility).toBe('no-hide-descendants');
    const veil = screen.getByTestId('ambient-veil', { includeHiddenElements: true });
    expect(styleOf(veil).backgroundColor).toBe(themes[theme].color.photoVeil);
  });

  it('apila todas las fotos y, pasado el intervalo, funde a la siguiente', async () => {
    jest.useFakeTimers();
    await renderThemed(<AmbientBackdrop sources={AMBIENT.welcome} />);
    await act(async () => {
      await Promise.resolve();
    });

    const layer = (index: number) =>
      screen.getByTestId(`ambient-photo-${String(index)}`, { includeHiddenElements: true });
    expect(AMBIENT.welcome.length).toBeGreaterThan(1);
    expect(animatedStyleOf(layer(0)).opacity).toBe(1);
    expect(animatedStyleOf(layer(1)).opacity).toBe(0);

    // Primero vence el intervalo (cambia la foto activa) y después corre el fundido
    await act(async () => {
      await jest.advanceTimersByTimeAsync(7000);
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(2000);
    });

    expect(animatedStyleOf(layer(1)).opacity).toBe(1);
    expect(animatedStyleOf(layer(0)).opacity).toBe(0);
  });

  it('Scenario: Movimiento reducido - una sola fotografía fija', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await renderThemed(<AmbientBackdrop sources={AMBIENT.welcome} />);

    await screen.findByTestId('ambient-photo-0', { includeHiddenElements: true });
    expect(screen.queryByTestId('ambient-photo-1', { includeHiddenElements: true })).toBeNull();
  });
});

import { INTER_FAMILY } from '@changehouse/ui';
import { renderHook } from '@testing-library/react-native';
import { useFonts } from 'expo-font';

import { APP_FONTS, useAppFonts } from './use-app-fonts';

jest.mock('expo-font', () => ({ useFonts: jest.fn() }));

describe('useAppFonts', () => {
  it('registra cada familia Inter que usan los tokens', () => {
    expect(Object.keys(APP_FONTS).sort()).toEqual(Object.values(INTER_FAMILY).sort());
  });

  it('no está listo mientras las fuentes cargan', async () => {
    jest.mocked(useFonts).mockReturnValue([false, null]);
    const { result } = await renderHook(() => useAppFonts());

    expect(result.current).toEqual({ ready: false, failed: false });
  });

  it('está listo cuando las fuentes cargan', async () => {
    jest.mocked(useFonts).mockReturnValue([true, null]);
    const { result } = await renderHook(() => useAppFonts());

    expect(result.current).toEqual({ ready: true, failed: false });
  });

  it('está listo aunque falle la carga, para usar la fuente del sistema', async () => {
    jest.mocked(useFonts).mockReturnValue([false, new Error('sin red')]);
    const { result } = await renderHook(() => useAppFonts());

    expect(result.current).toEqual({ ready: true, failed: true });
  });
});

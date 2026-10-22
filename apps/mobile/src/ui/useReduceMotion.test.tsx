import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { useReduceMotion } from './useReduceMotion';

type Listener = (enabled: boolean) => void;

function mockSystem(initial: boolean) {
  let listener: Listener = () => undefined;
  const remove = jest.fn();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(initial);
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((_event, handler) => {
    listener = handler;
    return { remove };
  });
  return { emit: (enabled: boolean) => listener(enabled), remove };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useReduceMotion', () => {
  it('es falso hasta saber lo que dice el sistema', async () => {
    mockSystem(false);

    const { result } = await renderHook(() => useReduceMotion());

    expect(result.current).toBe(false);
  });

  it('es verdadero si el sistema pide reducir el movimiento', async () => {
    mockSystem(true);

    const { result } = await renderHook(() => useReduceMotion());

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });

  it('sigue los cambios del sistema mientras la pantalla está abierta', async () => {
    const system = mockSystem(false);
    const { result } = await renderHook(() => useReduceMotion());

    await act(() => {
      system.emit(true);
    });
    expect(result.current).toBe(true);

    await act(() => {
      system.emit(false);
    });
    expect(result.current).toBe(false);
  });

  it('deja de escuchar al desmontarse', async () => {
    const system = mockSystem(false);
    const { unmount } = await renderHook(() => useReduceMotion());

    await unmount();

    expect(system.remove).toHaveBeenCalledTimes(1);
  });
});

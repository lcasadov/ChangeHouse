import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { markDecided, unmarkDecided, useDecidedIds } from './decided-cards';

function providerFor(queryClient: QueryClient) {
  return function Provider({ children }: Readonly<{ children: ReactNode }>) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

async function setup(uid = 'uid-1', homeId: string | undefined = 'home-1') {
  const queryClient = new QueryClient();
  const rendered = await renderHook(() => useDecidedIds(uid, homeId), {
    wrapper: providerFor(queryClient),
  });
  return { queryClient, ...rendered };
}

describe('useDecidedIds', () => {
  it('empieza sin nada decidido', async () => {
    const { result } = await setup();

    expect(result.current.size).toBe(0);
  });

  it('recuerda lo decidido y avisa a quien lo mira', async () => {
    const { result, queryClient } = await setup();

    await act(() => {
      markDecided(queryClient, 'uid-1', 'home-1', 'casa-a');
      markDecided(queryClient, 'uid-1', 'home-1', 'casa-b');
    });

    await waitFor(() => {
      expect([...result.current]).toEqual(['casa-a', 'casa-b']);
    });
  });

  it('olvida lo que se deshace', async () => {
    const { result, queryClient } = await setup();
    await act(() => {
      markDecided(queryClient, 'uid-1', 'home-1', 'casa-a');
      markDecided(queryClient, 'uid-1', 'home-1', 'casa-b');
    });
    await waitFor(() => {
      expect(result.current.size).toBe(2);
    });

    await act(() => {
      unmarkDecided(queryClient, 'uid-1', 'home-1', 'casa-b');
    });

    await waitFor(() => {
      expect([...result.current]).toEqual(['casa-a']);
    });
  });

  it('deshacer lo que no estaba decidido no cambia nada', async () => {
    const { result, queryClient } = await setup();

    await act(() => {
      unmarkDecided(queryClient, 'uid-1', 'home-1', 'casa-a');
    });

    expect(result.current.size).toBe(0);
  });

  it('cada vivienda decide por su cuenta (RF-20) y la cuenta de un buscador por la suya', async () => {
    const { result, queryClient } = await setup('uid-1', 'home-1');

    await act(() => {
      markDecided(queryClient, 'uid-1', 'home-2', 'casa-a');
      markDecided(queryClient, 'uid-1', undefined, 'casa-b');
      markDecided(queryClient, 'uid-2', 'home-1', 'casa-c');
    });

    expect(result.current.size).toBe(0);
  });

  it('se conserva aunque nadie lo esté mirando: al volver a «Explorar» sigue ahí', async () => {
    const { queryClient, unmount } = await setup();
    await act(() => {
      markDecided(queryClient, 'uid-1', 'home-1', 'casa-a');
    });
    await unmount();

    const again = await renderHook(() => useDecidedIds('uid-1', 'home-1'), {
      wrapper: providerFor(queryClient),
    });

    expect([...again.result.current]).toEqual(['casa-a']);
  });
});

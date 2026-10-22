import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';

import { AuthProvider } from '../auth/AuthProvider';
import { type AppServices, ServicesProvider } from './services';

/** Servicios, sesión y caché de consultas. Sin navegación: la pestaña Perfil y las pruebas lo usan solo. */
export function SessionProviders({
  services,
  children,
}: Readonly<{ services: AppServices; children: ReactNode }>) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <ServicesProvider services={services}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    </ServicesProvider>
  );
}

import type { AppServices } from './services';
import { SessionNavigator } from './SessionNavigator';
import { SessionProviders } from './SessionProviders';

/** Raíz de la sesión: servicios, estado de acceso y la navegación protegida por él. */
export function SessionRoot({ services }: Readonly<{ services: AppServices }>) {
  return (
    <SessionProviders services={services}>
      <SessionNavigator />
    </SessionProviders>
  );
}

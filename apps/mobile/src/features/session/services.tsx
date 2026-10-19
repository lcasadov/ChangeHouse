import { createContext, type ReactNode, useContext } from 'react';

import type { AccountApi } from '../account/account-api';
import type { AuthService, SocialSignIn } from '../auth/auth-service';
import type { AddressSuggestions } from '../homes/address-suggestions';
import type { HomesApi } from '../homes/homes-api';

/** Los puertos de salida que usa la interfaz; en la app van sobre Firebase y HTTP, en las pruebas son dobles. */
export interface AppServices {
  auth: AuthService;
  accountApi: AccountApi;
  homesApi: HomesApi;
  /** Autocompletado de direcciones del alta de viviendas (Google Places o sugerencias de prueba). */
  addressSuggestions: AddressSuggestions;
  /** Proveedores externos configurados en este dispositivo (vacío si no hay ninguno). */
  social: readonly SocialSignIn[];
  /** Dónde se leen los textos legales cuyas versiones se aceptan en el alta. */
  legalUrls: { terms: string; privacy: string };
}

const ServicesContext = createContext<AppServices | null>(null);

export function ServicesProvider({
  services,
  children,
}: Readonly<{ services: AppServices; children: ReactNode }>) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

export function useServices(): AppServices {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('useServices debe usarse dentro de ServicesProvider');
  return services;
}

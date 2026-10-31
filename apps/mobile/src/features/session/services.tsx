import { createContext, type ReactNode, useContext } from 'react';

import type { AccountApi } from '../account/account-api';
import type { DataExporter } from '../account/data-exporter';
import type { AdminApi } from '../admin/admin-api';
import type { AuthService, SocialSignIn } from '../auth/auth-service';
import type { ChatApi } from '../chat/chat-api';
import type { ChatMessages } from '../chat/chat-messages';
import type { DiscoveryApi } from '../discovery/discovery-api';
import type { AddressSuggestions } from '../homes/address-suggestions';
import type { HomesApi } from '../homes/homes-api';
import type { PhotoPicker } from '../homes/photo-picker';
import type { PhotoUploader } from '../homes/photo-uploader';
import type { MatchesApi } from '../matches/matches-api';
import type { PushNotifications } from '../notifications/push-notifications';
import type { SearchPreferencesApi } from '../search/search-preferences-api';
import type { ZoneSuggestions } from '../search/zone-suggestions';

/** Los puertos de salida que usa la interfaz; en la app van sobre Firebase y HTTP, en las pruebas son dobles. */
export interface AppServices {
  auth: AuthService;
  accountApi: AccountApi;
  /** La entrega del fichero de «Descargar mis datos»: compartir en el móvil, descarga en la web. */
  dataExporter: DataExporter;
  homesApi: HomesApi;
  /** La cola de moderación y las decisiones del equipo de administración. */
  adminApi: AdminApi;
  /** Autocompletado de direcciones del alta de viviendas (Google Places o sugerencias de prueba). */
  addressSuggestions: AddressSuggestions;
  /** La galería del dispositivo, de donde se eligen las fotos de la vivienda. */
  photoPicker: PhotoPicker;
  /** El envío directo de cada foto a su URL firmada de subida. */
  photoUploader: PhotoUploader;
  /** Las viviendas ajenas compatibles que ofrece «Explorar» y su detalle público. */
  discoveryApi: DiscoveryApi;
  /** Los matches del usuario (`listMyMatches`). */
  matchesApi: MatchesApi;
  /** Enviar mensajes e imágenes al chat de un match y pedir la URL de una imagen (`sendMatchMessage`…). */
  chatApi: ChatApi;
  /** Los mensajes del chat de un match en tiempo real (Firestore, solo lectura). */
  chatMessages: ChatMessages;
  /** Los avisos push del dispositivo: permiso, token y toques sobre un aviso. */
  pushNotifications: PushNotifications;
  /** Las preferencias de búsqueda del usuario y las propias de cada vivienda. */
  searchPreferencesApi: SearchPreferencesApi;
  /** Autocompletado de la zona de búsqueda: municipios y lugares (sugerencias de prueba sin clave). */
  zoneSuggestions: ZoneSuggestions;
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

/** Estado del permiso de avisos del sistema operativo. */
export type PushPermission = 'undetermined' | 'granted' | 'denied';

/** Sistema del dispositivo, tal como lo declara `registerDevice`. */
export type DevicePlatform = 'android' | 'ios' | 'web';

/** Los datos de un aviso que la app entiende: el tipo de evento y el match al que se refiere. */
export interface PushPayload {
  type: string;
  matchId: string;
}

/**
 * Puerto de los avisos push del dispositivo (en la app, `expo-notifications`; en la web, uno que no
 * hace nada porque no hay push).
 */
export interface PushNotifications {
  /** `false` donde no hay avisos push (la web): no se explica ni se pide nada. */
  readonly supported: boolean;
  readonly platform: DevicePlatform;
  /** El permiso actual, sin preguntar. */
  getPermission: () => Promise<PushPermission>;
  /** Pide el permiso al sistema y devuelve la respuesta. */
  requestPermission: () => Promise<PushPermission>;
  /** El token FCM del dispositivo, o `null` si no se ha podido obtener. */
  getDeviceToken: () => Promise<string | null>;
  /**
   * Avisa de cada aviso que la persona toca, incluido el que abrió la app. Devuelve la función que
   * deja de escuchar.
   */
  onOpen: (listener: (payload: PushPayload) => void) => () => void;
}

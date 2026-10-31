import type { DevicePlatform } from '@changehouse/shared';

/** Un dispositivo con notificaciones push: el token FCM lo identifica y lo usa una sola cuenta. */
export interface Device {
  readonly fcmToken: string;
  readonly userId: string;
  readonly platform: DevicePlatform;
  readonly at: Date;
}

/** Puerto de salida: los dispositivos registrados (`user_devices`). */
export interface DeviceRepository {
  /** Alta o refresco por token: registrarlo de nuevo actualiza la fila y, si cambia de cuenta, la traspasa. */
  upsert(device: Device): Promise<void>;
  /** Los tokens de las cuentas indicadas. */
  tokensOf(userIds: readonly string[]): Promise<string[]>;
  /** Borra los tokens indicados; los que no existen se ignoran. */
  deleteTokens(tokens: readonly string[]): Promise<void>;
}

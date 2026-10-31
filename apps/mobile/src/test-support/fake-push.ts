import type {
  DevicePlatform,
  PushNotifications,
  PushPayload,
  PushPermission,
} from '../features/notifications/push-notifications';

export interface FakePushOptions {
  /** El permiso con el que parte el dispositivo (por defecto, sin decidir). */
  permission?: PushPermission;
  /** Lo que responde la persona cuando el sistema le pide permiso (por defecto, lo concede). */
  answer?: Exclude<PushPermission, 'undetermined'>;
  token?: string | null;
  platform?: DevicePlatform;
  supported?: boolean;
  /** Obtener el token falla (sin Google Play Services, sin red…). */
  tokenFails?: boolean;
}

/** Los avisos del dispositivo: el permiso, el token y los toques sobre un aviso se controlan desde la prueba. */
export class FakePushNotifications implements PushNotifications {
  readonly supported: boolean;
  readonly platform: DevicePlatform;
  /** Cuántas veces la app ha pedido el permiso al sistema. */
  requests = 0;
  permission: PushPermission;
  answer: Exclude<PushPermission, 'undetermined'>;
  token: string | null;
  tokenFails: boolean;
  private readonly listeners = new Set<(payload: PushPayload) => void>();

  constructor({
    permission = 'undetermined',
    answer = 'granted',
    token = 'fcm-token-1',
    platform = 'android',
    supported = true,
    tokenFails = false,
  }: FakePushOptions = {}) {
    this.permission = permission;
    this.answer = answer;
    this.token = token;
    this.platform = platform;
    this.supported = supported;
    this.tokenFails = tokenFails;
  }

  getPermission = () => Promise.resolve(this.permission);

  requestPermission = () => {
    this.requests += 1;
    this.permission = this.answer;
    return Promise.resolve(this.permission);
  };

  getDeviceToken = () =>
    this.tokenFails ? Promise.reject(new Error('Sin token')) : Promise.resolve(this.token);

  onOpen = (listener: (payload: PushPayload) => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** La persona toca un aviso. */
  tap(payload: PushPayload): void {
    this.listeners.forEach((listener) => {
      listener(payload);
    });
  }
}

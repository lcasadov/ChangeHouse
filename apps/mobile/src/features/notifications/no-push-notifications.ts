import type { PushNotifications } from './push-notifications';

/** Los avisos donde no hay push (la web): no hay permiso que pedir ni aviso que tocar. */
export function createNoPushNotifications(): PushNotifications {
  return {
    supported: false,
    platform: 'web',
    getPermission: () => Promise.resolve('denied'),
    requestPermission: () => Promise.resolve('denied'),
    getDeviceToken: () => Promise.resolve(null),
    onOpen: () => () => undefined,
  };
}

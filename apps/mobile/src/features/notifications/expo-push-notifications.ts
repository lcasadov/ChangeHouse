import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type {
  DevicePlatform,
  PushNotifications,
  PushPayload,
  PushPermission,
} from './push-notifications';

function permissionOf(status: Notifications.NotificationPermissionsStatus): PushPermission {
  if (status.granted) return 'granted';
  return status.canAskAgain ? 'undetermined' : 'denied';
}

function payloadOf(response: Notifications.NotificationResponse | null): PushPayload | null {
  const data: unknown = response?.notification.request.content.data;
  if (typeof data !== 'object' || data === null) return null;
  const { type, matchId } = data as Record<string, unknown>;
  return typeof type === 'string' && typeof matchId === 'string' ? { type, matchId } : null;
}

/** Los avisos reales del dispositivo (Android e iOS) sobre `expo-notifications`. */
export function createExpoPushNotifications(): PushNotifications {
  const platform: DevicePlatform = Platform.OS === 'ios' ? 'ios' : 'android';
  return {
    supported: true,
    platform,
    async getPermission() {
      return permissionOf(await Notifications.getPermissionsAsync());
    },
    async requestPermission() {
      return permissionOf(await Notifications.requestPermissionsAsync());
    },
    async getDeviceToken() {
      const token = await Notifications.getDevicePushTokenAsync();
      return typeof token.data === 'string' && token.data !== '' ? token.data : null;
    },
    onOpen(listener) {
      const open = (response: Notifications.NotificationResponse | null) => {
        const payload = payloadOf(response);
        if (payload) listener(payload);
      };
      // El aviso que abrió la app (arranque en frío) y los que se toquen después
      Notifications.getLastNotificationResponseAsync().then(open, () => undefined);
      const subscription = Notifications.addNotificationResponseReceivedListener(open);
      return () => {
        subscription.remove();
      };
    },
  };
}

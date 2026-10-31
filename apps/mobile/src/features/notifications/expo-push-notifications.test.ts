import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { createExpoPushNotifications } from './expo-push-notifications';

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getDevicePushTokenAsync: jest.fn(),
  getLastNotificationResponseAsync: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
}));

const mocked = jest.mocked(Notifications);
const status = (granted: boolean, canAskAgain: boolean) =>
  ({ granted, canAskAgain }) as Notifications.NotificationPermissionsStatus;
const response = (data: unknown) =>
  ({ notification: { request: { content: { data } } } }) as Notifications.NotificationResponse;

beforeEach(() => {
  jest.clearAllMocks();
  mocked.getLastNotificationResponseAsync.mockResolvedValue(null);
  mocked.addNotificationResponseReceivedListener.mockReturnValue({ remove: jest.fn() });
});

describe('permiso', () => {
  it.each([
    [true, false, 'granted'],
    [false, true, 'undetermined'],
    [false, false, 'denied'],
  ] as const)('granted=%s canAskAgain=%s se lee como %s', async (granted, canAsk, expected) => {
    mocked.getPermissionsAsync.mockResolvedValue(status(granted, canAsk));
    mocked.requestPermissionsAsync.mockResolvedValue(status(granted, canAsk));
    const push = createExpoPushNotifications();

    expect(await push.getPermission()).toBe(expected);
    expect(await push.requestPermission()).toBe(expected);
  });
});

describe('token y sistema', () => {
  it('devuelve el token nativo del dispositivo', async () => {
    mocked.getDevicePushTokenAsync.mockResolvedValue({ type: 'android', data: 'fcm-1' });

    expect(await createExpoPushNotifications().getDeviceToken()).toBe('fcm-1');
  });

  it('devuelve null si el token no es un texto', async () => {
    mocked.getDevicePushTokenAsync.mockResolvedValue({
      type: 'ios',
      data: 7 as unknown as string,
    });

    expect(await createExpoPushNotifications().getDeviceToken()).toBeNull();
  });

  it.each([
    ['ios', 'ios'],
    ['android', 'android'],
  ] as const)('en %s declara el sistema %s', (os, expected) => {
    const original = Platform.OS;
    Platform.OS = os;
    try {
      expect(createExpoPushNotifications().platform).toBe(expected);
    } finally {
      Platform.OS = original;
    }
  });
});

describe('onOpen', () => {
  it('avisa del aviso que abrió la app y de los que se toquen después', async () => {
    mocked.getLastNotificationResponseAsync.mockResolvedValue(
      response({ type: 'match.created', matchId: 'm1' }),
    );
    const listener = jest.fn();

    createExpoPushNotifications().onOpen(listener);
    await Promise.resolve();
    await Promise.resolve();
    const tap = mocked.addNotificationResponseReceivedListener.mock.calls[0]?.[0];
    tap?.(response({ type: 'message.sent', matchId: 'm2' }));

    expect(listener.mock.calls).toEqual([
      [{ type: 'match.created', matchId: 'm1' }],
      [{ type: 'message.sent', matchId: 'm2' }],
    ]);
  });

  it.each([
    ['sin datos', undefined],
    ['sin match', { type: 'match.created' }],
  ])('ignora un aviso %s', (_name, data) => {
    const listener = jest.fn();
    createExpoPushNotifications().onOpen(listener);

    mocked.addNotificationResponseReceivedListener.mock.calls[0]?.[0](response(data));

    expect(listener).not.toHaveBeenCalled();
  });

  it('deja de escuchar al darse de baja y tolera que no haya aviso previo', async () => {
    const remove = jest.fn();
    mocked.addNotificationResponseReceivedListener.mockReturnValue({ remove });
    mocked.getLastNotificationResponseAsync.mockRejectedValue(new Error('nativo'));

    const stop = createExpoPushNotifications().onOpen(jest.fn());
    await Promise.resolve();
    stop();

    expect(remove).toHaveBeenCalledTimes(1);
  });
});

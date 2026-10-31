import { createNoPushNotifications } from './no-push-notifications';

describe('createNoPushNotifications', () => {
  it('en la web no hay push: no se admite, no concede permiso ni da token', async () => {
    const push = createNoPushNotifications();
    const stop = push.onOpen(() => undefined);

    expect(push.supported).toBe(false);
    expect(push.platform).toBe('web');
    expect(await push.getPermission()).toBe('denied');
    expect(await push.requestPermission()).toBe('denied');
    expect(await push.getDeviceToken()).toBeNull();
    expect(stop()).toBeUndefined();
  });
});

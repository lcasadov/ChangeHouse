import * as ExpoHaptics from 'expo-haptics';
import { Platform } from 'react-native';

import { haptics } from './haptics';

afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

describe('haptics', () => {
  it('una vibración ligera al cruzar el umbral', async () => {
    await haptics.threshold();

    expect(ExpoHaptics.impactAsync).toHaveBeenCalledWith(ExpoHaptics.ImpactFeedbackStyle.Light);
  });

  it('un aviso de éxito al registrar la decisión', async () => {
    await haptics.success();

    expect(ExpoHaptics.notificationAsync).toHaveBeenCalledWith(
      ExpoHaptics.NotificationFeedbackType.Success,
    );
  });

  it('en la web no vibra', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');

    await haptics.threshold();
    await haptics.success();

    expect(ExpoHaptics.impactAsync).not.toHaveBeenCalled();
    expect(ExpoHaptics.notificationAsync).not.toHaveBeenCalled();
  });

  it('un dispositivo sin motor háptico no rompe nada', async () => {
    jest.mocked(ExpoHaptics.impactAsync).mockRejectedValueOnce(new Error('sin háptica'));

    await expect(haptics.threshold()).resolves.toBeUndefined();
  });
});

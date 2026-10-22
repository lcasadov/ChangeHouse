import * as ExpoHaptics from 'expo-haptics';
import { Platform } from 'react-native';

/** La web no vibra; un dispositivo sin motor háptico tampoco debe romper la decisión que acompaña. */
async function run(feedback: () => Promise<void>): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await feedback();
  } catch {
    // Sin háptica el gesto sigue funcionando: la vibración solo lo confirma
  }
}

export const haptics = {
  /** Ligera: la tarjeta acaba de cruzar el umbral y al soltarla se decidirá. */
  threshold: () => run(() => ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Light)),
  /** De éxito: la decisión se ha registrado. */
  success: () =>
    run(() => ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Success)),
};

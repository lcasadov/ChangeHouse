import {
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';

/** Pesos de Inter de `docs/style-guide.md` §1; las claves coinciden con `INTER_FAMILY` de `@changehouse/ui`. */
export const APP_FONTS = {
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
};

/**
 * Carga Inter. `ready` pasa a `true` al terminar **o al fallar**: si falla, la interfaz
 * se muestra con la fuente del sistema en lugar de quedarse en el splash.
 */
export function useAppFonts(): { ready: boolean; failed: boolean } {
  const [loaded, error] = useFonts(APP_FONTS);
  return { ready: loaded || error !== null, failed: error !== null };
}

import { motion } from '@changehouse/ui';
import { Dimensions } from 'react-native';
import {
  type EntryExitAnimationFunction,
  FadeOut,
  type SharedValue,
  withTiming,
} from 'react-native-reanimated';

/** Hacia dónde sale la tarjeta: 1 a la derecha («me gusta»), -1 a la izquierda («descartar») y 0 sin lado. */
export type ExitDirection = -1 | 0 | 1;

/** Cuántos anchos de pantalla recorre la tarjeta al salir volando. */
const FLY_SCREENS = 1.2;
/** Inclinación (grados) con la que sale, la misma que lleva al arrastrarla hasta el borde. */
export const EXIT_TILT_DEGREES = 15;

/**
 * Cómo sale la tarjeta de la pila: vuela hacia el lado que indique `direction` y se inclina, o, con
 * «reducir movimiento» (`docs/style-guide.md` §1), se desvanece sin desplazarse ni girar. Sin lado
 * (0: sale por otra razón, como un error o un deshacer) también se desvanece.
 *
 * El lado es un valor compartido y no una propiedad: la animación de salida se lee al desmontar la
 * tarjeta, con las propiedades del renderizado anterior, y la decisión que la quita ocurre justo
 * después de saberse el lado.
 */
export function exitingFor(direction: SharedValue<ExitDirection>, reduceMotion: boolean) {
  if (reduceMotion) return FadeOut.duration(motion.fast);
  const distance = Dimensions.get('window').width * FLY_SCREENS;
  const duration = motion.base;
  const fly: EntryExitAnimationFunction = () => {
    'worklet';
    const sign = direction.value;
    return {
      initialValues: { opacity: 1, transform: [{ translateX: 0 }, { rotate: '0deg' }] },
      animations: {
        opacity: withTiming(0, { duration }),
        transform: [
          { translateX: withTiming(sign * distance, { duration }) },
          { rotate: withTiming(`${String(sign * EXIT_TILT_DEGREES)}deg`, { duration }) },
        ],
      },
    };
  };
  return fly;
}

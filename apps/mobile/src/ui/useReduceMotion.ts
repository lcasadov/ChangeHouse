import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * `true` si el sistema pide reducir el movimiento (`docs/style-guide.md` §1 «Movimiento»): las
 * animaciones de transición se sustituyen entonces por cambios inmediatos. Sigue los cambios del
 * ajuste mientras la pantalla está abierta.
 */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active) setReduce(enabled);
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduce;
}

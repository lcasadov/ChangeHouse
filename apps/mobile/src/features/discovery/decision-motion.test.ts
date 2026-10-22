import { FadeOut, makeMutable } from 'react-native-reanimated';

import { type ExitDirection, exitingFor } from './decision-motion';

const direction = (value: ExitDirection) => makeMutable<ExitDirection>(value);

/** La animación de vuelo, ya evaluada: su desplazamiento final y el número de transformaciones. */
type Flight = { animations: { transform: [{ translateX: { toValue: number } }, unknown] } };
const flightOf = (side: ReturnType<typeof direction>): Flight => {
  const fly = exitingFor(side, false) as unknown as (values: never) => Flight;
  return fly({} as never);
};

describe('exitingFor', () => {
  it('con «reducir movimiento» la tarjeta se desvanece, sin volar, vaya hacia donde vaya', () => {
    expect(exitingFor(direction(1), true)).toBeInstanceOf(FadeOut);
    expect(exitingFor(direction(-1), true)).toBeInstanceOf(FadeOut);
  });

  it('sin «reducir movimiento» la tarjeta vuela y se inclina hacia el lado de la decisión', () => {
    expect(typeof exitingFor(direction(1), false)).toBe('function');
    expect(flightOf(direction(1)).animations.transform).toHaveLength(2);
    expect(flightOf(direction(1)).animations.transform[0].translateX.toValue).toBeGreaterThan(0);
    expect(flightOf(direction(-1)).animations.transform[0].translateX.toValue).toBeLessThan(0);
  });

  it('sin lado (la tarjeta sale por otra razón) no se desplaza: solo se desvanece', () => {
    expect(flightOf(direction(0)).animations.transform[0].translateX.toValue).toBe(0);
  });

  it('lee el lado al animar y no al crearse: la decisión llega después', () => {
    const side = direction(0);
    const fly = exitingFor(side, false) as unknown as (values: never) => Flight;

    side.value = -1;

    expect(fly({} as never).animations.transform[0].translateX.toValue).toBeLessThan(0);
  });
});

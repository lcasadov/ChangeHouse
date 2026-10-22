import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as ExpoHaptics from 'expo-haptics';
import { AccessibilityInfo, Text as NativeText } from 'react-native';
import {
  createGestureController,
  getByGestureTestId,
} from 'react-native-gesture-handler/jest-utils';

import es from '../../i18n/locales/es-ES.json';
import { animatedStyleOf, renderThemed } from '../../test-utils';
import { SwipeableCard, type SwipeableCardProps } from './SwipeableCard';

const WIDTH = 400;
// El umbral es el 30 % del ancho: 120
const BEYOND = 150;
const SHORT = 100;

type Transform = Record<string, unknown>[];

async function setup(overrides: Partial<Omit<SwipeableCardProps, 'children'>> = {}) {
  const props: Omit<SwipeableCardProps, 'children'> = {
    enabled: true,
    canLike: true,
    onDecide: jest.fn(),
    onBlockedLike: jest.fn(),
    ...overrides,
  };
  await renderThemed(
    <SwipeableCard {...props}>
      <NativeText>contenido</NativeText>
    </SwipeableCard>,
  );
  return props;
}

async function layOut() {
  await fireEvent(screen.getByTestId('swipeable-card'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: WIDTH, height: 600 } },
  });
}

/** Un dedo que arrastra: devuelve el controlador para seguir moviéndolo. */
function startDrag() {
  const controller = createGestureController('card-swipe');
  controller.begin();
  controller.activate();
  return controller;
}

function release(to: number, velocityX = 0) {
  const controller = startDrag();
  controller.update({ translationX: to, velocityX });
  controller.end({ translationX: to, velocityX });
}

const cardStyle = () => animatedStyleOf(screen.getByTestId('swipeable-card'));
const transformOf = () => (cardStyle().transform ?? []) as Transform;
const stampOpacity = (stamp: 'like' | 'dismiss') =>
  Number(
    animatedStyleOf(screen.getByTestId(`stamp-${stamp}`, { includeHiddenElements: true })).opacity,
  );

afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

describe('SwipeableCard', () => {
  it('deslizar a la derecha más allá del umbral decide «Me gusta»', async () => {
    const props = await setup();
    await layOut();

    release(BEYOND);

    await waitFor(() => {
      expect(props.onDecide).toHaveBeenCalledWith('like');
    });
    expect(props.onDecide).toHaveBeenCalledTimes(1);
  });

  it('deslizar a la izquierda más allá del umbral decide «Descartar»', async () => {
    const props = await setup();
    await layOut();

    release(-BEYOND);

    await waitFor(() => {
      expect(props.onDecide).toHaveBeenCalledWith('dismiss');
    });
  });

  it('un deslizamiento corto y lento no decide nada y la tarjeta vuelve a su sitio', async () => {
    const props = await setup();
    await layOut();
    const controller = startDrag();
    controller.update({ translationX: SHORT });
    await waitFor(() => {
      expect(transformOf()).toEqual(expect.arrayContaining([{ translateX: SHORT }]));
    });

    controller.end({ translationX: SHORT });

    expect(props.onDecide).not.toHaveBeenCalled();
    expect(props.onBlockedLike).not.toHaveBeenCalled();
  });

  it('un gesto corto pero rápido también decide', async () => {
    const props = await setup();
    await layOut();

    release(40, 1500);

    await waitFor(() => {
      expect(props.onDecide).toHaveBeenCalledWith('like');
    });
  });

  it('mientras se arrastra, el sello del lado crece en proporción al umbral y el otro no se ve', async () => {
    await setup();
    await layOut();
    const controller = startDrag();

    controller.update({ translationX: 60 });
    await waitFor(() => {
      expect(stampOpacity('like')).toBeCloseTo(0.5);
    });
    expect(stampOpacity('dismiss')).toBe(0);

    controller.update({ translationX: -120 });
    await waitFor(() => {
      expect(stampOpacity('dismiss')).toBeCloseTo(1);
    });
    expect(stampOpacity('like')).toBe(0);
    controller.end({ translationX: 0 });
  });

  it('los sellos dicen «Me gusta» y «Descartar» y no se exponen a los lectores de pantalla', async () => {
    await setup();

    expect(
      screen.getByText(es.discovery.stamps.like, { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(
      screen.getByText(es.discovery.stamps.dismiss, { includeHiddenElements: true }),
    ).toBeTruthy();
    const like = screen.getByTestId('stamp-like', { includeHiddenElements: true });
    const dismiss = screen.getByTestId('stamp-dismiss', { includeHiddenElements: true });
    expect(like.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(dismiss.props.accessibilityElementsHidden).toBe(true);
  });

  it('la tarjeta se inclina ligeramente al arrastrar', async () => {
    await setup();
    await layOut();
    const controller = startDrag();

    controller.update({ translationX: SHORT });

    await waitFor(() => {
      const [, second] = transformOf() as [unknown, { rotate: string }];
      expect(transformOf()[0]).toEqual({ translateX: SHORT });
      expect(Number.parseFloat(second.rotate)).toBeGreaterThan(0);
      expect(Number.parseFloat(second.rotate)).toBeLessThan(20);
    });
    controller.end({ translationX: 0 });
  });

  it('con «reducir movimiento» la tarjeta sigue al dedo pero no se inclina', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await setup();
    await layOut();
    // El ajuste del sistema se lee de forma asíncrona: la inclinación desaparece al conocerlo
    const controller = startDrag();
    controller.update({ translationX: SHORT });

    await waitFor(() => {
      expect(transformOf()).toEqual(expect.arrayContaining([{ translateX: SHORT }]));
      expect(transformOf().some((entry) => 'rotate' in entry && entry.rotate !== '0deg')).toBe(
        false,
      );
    });
    controller.end({ translationX: 0 });
  });

  it('vibra una vez, ligera, al cruzar el umbral y de nuevo si se vuelve a cruzar', async () => {
    await setup();
    await layOut();
    const controller = startDrag();

    controller.update({ translationX: SHORT });
    controller.update({ translationX: BEYOND });
    controller.update({ translationX: BEYOND + 30 });
    await waitFor(() => {
      expect(ExpoHaptics.impactAsync).toHaveBeenCalledTimes(1);
    });
    expect(ExpoHaptics.impactAsync).toHaveBeenCalledWith(ExpoHaptics.ImpactFeedbackStyle.Light);

    controller.update({ translationX: SHORT });
    controller.update({ translationX: BEYOND });
    await waitFor(() => {
      expect(ExpoHaptics.impactAsync).toHaveBeenCalledTimes(2);
    });
    controller.end({ translationX: 0 });
  });

  it('sin vivienda publicada, deslizar a la derecha no decide: avisa y la tarjeta vuelve', async () => {
    const props = await setup({ canLike: false });
    await layOut();

    release(BEYOND);

    await waitFor(() => {
      expect(props.onBlockedLike).toHaveBeenCalledTimes(1);
    });
    expect(props.onDecide).not.toHaveBeenCalled();
  });

  it('sin vivienda publicada, deslizar a la izquierda sí descarta', async () => {
    const props = await setup({ canLike: false });
    await layOut();

    release(-BEYOND);

    await waitFor(() => {
      expect(props.onDecide).toHaveBeenCalledWith('dismiss');
    });
  });

  it('una tarjeta que no es la de delante no responde a gestos', async () => {
    await setup({ enabled: false });

    expect(() => getByGestureTestId('card-swipe')).toThrow();
  });
});

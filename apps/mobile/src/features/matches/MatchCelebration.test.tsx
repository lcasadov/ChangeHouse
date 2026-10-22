import { themes } from '@changehouse/ui';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { AccessibilityInfo, processColor } from 'react-native';

import es from '../../i18n/locales/es-ES.json';
import { animatedStyleOf, renderThemed, THEME_NAMES } from '../../test-utils';
import { formatEuros } from '../homes/home-form';
import { MatchCelebration, type MatchCelebrationProps } from './MatchCelebration';

const c = es.matches.celebration;
const STAGE_WIDTH = 320;

const MINE = { title: 'Piso en Chamberí', coverUrl: 'https://cdn.changehouse.test/mine.webp' };
const THEIRS = { title: 'Ático en Lavapiés', coverUrl: 'https://cdn.changehouse.test/theirs.webp' };

function props(overrides: Partial<MatchCelebrationProps> = {}): MatchCelebrationProps {
  return {
    visible: true,
    mine: MINE,
    theirs: THEIRS,
    compensation: { kind: 'pay', amountCents: 1_200_000 },
    onView: jest.fn(),
    onContinue: jest.fn(),
    ...overrides,
  };
}

async function show(overrides: Partial<MatchCelebrationProps> = {}, theme?: 'light' | 'dark') {
  const given = props(overrides);
  await renderThemed(<MatchCelebration {...given} />, theme);
  return given;
}

async function layOut() {
  await fireEvent(screen.getByTestId('swap-stage'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: STAGE_WIDTH, height: 200 } },
  });
}

const shiftOf = (side: 'mine' | 'theirs') => {
  const transform = (animatedStyleOf(screen.getByTestId(`swap-tile-${side}`)).transform ??
    []) as Record<string, number>[];
  return transform.find((entry) => 'translateX' in entry)?.['translateX'] ?? 0;
};

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

describe('MatchCelebration', () => {
  it('Scenario: Match al dar me gusta - muestra el título, las dos casas, la compensación y los botones', async () => {
    await show();

    expect(screen.getByRole('header', { name: c.title })).toBeTruthy();
    expect(screen.getByText(c.subtitle)).toBeTruthy();
    expect(screen.getByText(`${MINE.title} por ${THEIRS.title}`)).toBeTruthy();
    expect(screen.getByTestId('match-cover-mine').props.source).toEqual([{ uri: MINE.coverUrl }]);
    expect(screen.getByTestId('match-cover-theirs').props.source).toEqual([
      { uri: THEIRS.coverUrl },
    ]);
    expect(screen.getByText(`Tú pagas ${formatEuros(1_200_000)}`)).toBeTruthy();
    expect(screen.getByText(es.discovery.compensation.disclaimer)).toBeTruthy();
    expect(screen.getByRole('button', { name: c.view })).toBeTruthy();
    expect(screen.getByRole('button', { name: c.continue })).toBeTruthy();
  });

  it.each([
    [{ kind: 'receive', amountCents: 800_000 }, `Tú recibes ${formatEuros(800_000)}`],
    [{ kind: 'fair', amountCents: 0 }, es.discovery.compensation.fair],
  ] as const)('con la compensación %j dice «%s»', async (compensation, text) => {
    await show({ compensation });

    expect(screen.getByText(text)).toBeTruthy();
  });

  it('«Ver match» y «Seguir explorando» avisan a quien la muestra', async () => {
    const given = await show();

    await fireEvent.press(screen.getByRole('button', { name: c.view }));
    expect(given.onView).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByRole('button', { name: c.continue }));
    expect(given.onContinue).toHaveBeenCalledTimes(1);
  });

  it('el gesto o botón de volver equivale a seguir explorando', async () => {
    const given = await show();

    await fireEvent(screen.getByTestId('match-celebration'), 'requestClose');

    expect(given.onContinue).toHaveBeenCalledTimes(1);
    expect(given.onView).not.toHaveBeenCalled();
  });

  it('oculta la celebración cuando no es visible', async () => {
    await show({ visible: false });

    expect(screen.queryByRole('header', { name: c.title })).toBeNull();
  });

  it('una casa sin foto se sustituye por un marcador, sin imagen rota', async () => {
    await show({ theirs: { title: THEIRS.title, coverUrl: undefined } });

    expect(screen.queryByTestId('match-cover-theirs')).toBeNull();
    expect(screen.getByTestId('match-cover-theirs-placeholder')).toBeTruthy();
    expect(screen.getByTestId('match-cover-mine')).toBeTruthy();
  });

  it('sin saber cuál es su casa no inventa una compensación', async () => {
    await show({ compensation: null });

    expect(screen.queryByTestId('compensation-pill')).toBeNull();
    expect(screen.queryByText(es.discovery.compensation.disclaimer)).toBeNull();
    expect(screen.getByRole('button', { name: c.view })).toBeTruthy();
  });

  it('el modal se declara como tal a los lectores de pantalla y las fotos son decorativas', async () => {
    await show();

    expect(screen.getByTestId('match-celebration').props.accessibilityViewIsModal).toBe(true);
    expect(screen.getByTestId('match-cover-mine').props.accessible).toBe(false);
    expect(screen.getByTestId('match-cover-theirs').props.accessible).toBe(false);
  });

  it.each(THEME_NAMES)('el fondo usa el degradado de match del tema %s', async (theme) => {
    await show({}, theme);

    expect(screen.getByTestId('match-gradient').props.colors).toEqual([
      processColor(themes[theme].color.matchGradientStart),
      processColor(themes[theme].color.matchGradientEnd),
    ]);
    expect(screen.getByRole('button', { name: c.view })).toBeTruthy();
  });
});

describe('animación de intercambio', () => {
  it('las casas arrancan en su sitio y acaban intercambiadas', async () => {
    jest.useFakeTimers();
    await show();
    await layOut();

    expect(shiftOf('mine')).toBeCloseTo(0);
    expect(shiftOf('theirs')).toBeCloseTo(0);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(2000);
    });

    expect(shiftOf('mine')).toBeGreaterThan(0);
    expect(shiftOf('theirs')).toBe(-shiftOf('mine'));
  });

  it('con «reducir movimiento» aparecen ya intercambiadas, sin recorrido', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await show();
    await layOut();

    expect(await screen.findByTestId('swap-tile-mine')).toBeTruthy();
    await act(async () => {
      await Promise.resolve();
    });

    expect(shiftOf('mine')).toBeGreaterThan(0);
    expect(shiftOf('theirs')).toBe(-shiftOf('mine'));
  });
});

import { describe, expect, it } from 'vitest';

import {
  FakeMatchLookup,
  InMemoryDecisionStore,
  InMemoryDecisionUnitOfWork,
  InMemoryHomeRepository,
} from '../../../test/fakes.js';
import { type Home, newDraft } from '../../domain/home/home.js';
import { HomeNotFoundError } from '../home/errors.js';
import { decisionOperations } from './decision-operations.js';
import {
  DailyLikeLimitError,
  HomeNotPublishedError,
  LikeExistsError,
  LikeInMatchError,
  NothingToUndoError,
  OriginHomeRequiredError,
} from './errors.js';

const ME = 'user-me';
const OTHER = 'user-other';
const MY_HOME = 'home-mine';
const SECOND_HOME = 'home-mine-2';
const THEIR_HOME = 'home-theirs';
const LIMIT = 10;
const SECONDS_PER_HOUR = 3_600;

const LOCATION = {
  exact: { lat: 40.3056, lng: -3.7321 },
  areaName: 'Getafe Centro',
  areaCenter: { lat: 40.306, lng: -3.7325 },
};

function home(id: string, ownerId: string, status: Home['status'] = 'published'): Home {
  const draft = newDraft({
    id,
    ownerId,
    now: new Date('2026-10-01T09:00:00.000Z'),
    type: 'piso',
    address: 'Calle Madrid, 8, Getafe',
    location: LOCATION,
  });
  return { ...draft, status };
}

function setup(now = new Date('2026-10-19T10:00:00.000Z'), homesToAdd: Home[] = []) {
  const clock = { current: now };
  const homes = new InMemoryHomeRepository();
  for (const added of [
    home(MY_HOME, ME),
    home(THEIR_HOME, OTHER),
    home('home-draft', ME, 'draft'),
    home('their-draft', OTHER, 'draft'),
    ...homesToAdd,
  ]) {
    homes.homes.set(added.id, added);
  }
  const store = new InMemoryDecisionStore(homes);
  const matches = new FakeMatchLookup();
  const operations = decisionOperations({
    homes,
    units: new InMemoryDecisionUnitOfWork(store),
    matches,
    clock: { now: () => clock.current },
    likesPerDay: LIMIT,
  });
  return { operations, homes, store, matches, clock };
}

type Prepared = ReturnType<typeof setup>;

/** Deja `count` me gusta dados hoy desde `from`, a destinos distintos. */
function seedLikes(prepared: Prepared, count: number, from = MY_HOME, at = prepared.clock.current) {
  for (let index = 0; index < count; index += 1) {
    prepared.store.likes.push({ from, to: `destino-${String(index)}`, at });
  }
}

describe('likeHome', () => {
  it('Scenario: Me gusta válido - registra la arista desde mi vivienda con la fecha del reloj y no hay match', async () => {
    const { operations, store, clock } = setup();

    const result = await operations.likeHome(ME, { fromHomeId: MY_HOME, targetHomeId: THEIR_HOME });

    expect(result).toEqual({ liked: true, match: null });
    expect(store.likes).toEqual([{ from: MY_HOME, to: THEIR_HOME, at: clock.current }]);
    expect(store.locks).toEqual([ME]);
  });

  it('Scenario: Desde una vivienda que no es suya o no está publicada - una ajena o inexistente es 404', async () => {
    const { operations, store } = setup();

    for (const fromHomeId of [THEIR_HOME, 'no-existe']) {
      await expect(
        operations.likeHome(ME, { fromHomeId, targetHomeId: THEIR_HOME }),
      ).rejects.toBeInstanceOf(HomeNotFoundError);
    }
    expect(store.likes).toEqual([]);
  });

  it('Scenario: Desde una vivienda que no es suya o no está publicada - una propia en borrador es 409 HOME_NOT_PUBLISHED', async () => {
    const { operations, store } = setup();

    const attempt = operations.likeHome(ME, {
      fromHomeId: 'home-draft',
      targetHomeId: THEIR_HOME,
    });

    await expect(attempt).rejects.toBeInstanceOf(HomeNotPublishedError);
    await expect(attempt).rejects.toMatchObject({ code: 'HOME_NOT_PUBLISHED', kind: 'conflict' });
    expect(store.likes).toEqual([]);
  });

  it.each([
    ['una vivienda propia', SECOND_HOME],
    ['una vivienda ajena en borrador', 'their-draft'],
    ['una vivienda inexistente', 'no-existe'],
    ['la propia vivienda de origen', MY_HOME],
  ])('el destino %s es 404', async (_name, targetHomeId) => {
    const { operations, store } = setup(undefined, [home(SECOND_HOME, ME)]);

    await expect(
      operations.likeHome(ME, { fromHomeId: MY_HOME, targetHomeId }),
    ).rejects.toBeInstanceOf(HomeNotFoundError);
    expect(store.likes).toEqual([]);
  });

  it('Scenario: Me gusta repetido - responde LIKE_EXISTS y sigue habiendo una sola arista', async () => {
    const { operations, store } = setup();
    await operations.likeHome(ME, { fromHomeId: MY_HOME, targetHomeId: THEIR_HOME });

    const repeated = operations.likeHome(ME, { fromHomeId: MY_HOME, targetHomeId: THEIR_HOME });

    await expect(repeated).rejects.toBeInstanceOf(LikeExistsError);
    await expect(repeated).rejects.toMatchObject({ code: 'LIKE_EXISTS', kind: 'conflict' });
    expect(store.likes).toHaveLength(1);
  });

  it('un me gusta repetido responde LIKE_EXISTS aunque el cupo del día esté agotado', async () => {
    const prepared = setup();
    await prepared.operations.likeHome(ME, { fromHomeId: MY_HOME, targetHomeId: THEIR_HOME });
    seedLikes(prepared, LIMIT - 1);

    await expect(
      prepared.operations.likeHome(ME, { fromHomeId: MY_HOME, targetHomeId: THEIR_HOME }),
    ).rejects.toBeInstanceOf(LikeExistsError);
  });
});

describe('límite diario de me gusta', () => {
  it('Scenario: Undécimo me gusta del día - responde 429 con los segundos hasta la medianoche de Madrid', async () => {
    const prepared = setup(new Date('2026-10-19T10:00:00.000Z'));
    seedLikes(prepared, LIMIT);

    const eleventh = prepared.operations.likeHome(ME, {
      fromHomeId: MY_HOME,
      targetHomeId: THEIR_HOME,
    });

    await expect(eleventh).rejects.toBeInstanceOf(DailyLikeLimitError);
    // 10:00 UTC son las 12:00 en Madrid (CEST): quedan 12 horas
    await expect(eleventh).rejects.toMatchObject({
      code: 'DAILY_LIKE_LIMIT',
      kind: 'rate_limited',
      retryAfterSeconds: 12 * SECONDS_PER_HOUR,
    });
    expect(prepared.store.likes).toHaveLength(LIMIT);
  });

  it('el décimo sí se admite: el límite se supera con el undécimo', async () => {
    const prepared = setup();
    seedLikes(prepared, LIMIT - 1);

    await expect(
      prepared.operations.likeHome(ME, { fromHomeId: MY_HOME, targetHomeId: THEIR_HOME }),
    ).resolves.toEqual({ liked: true, match: null });
  });

  it('suma los me gusta de todas sus viviendas', async () => {
    const prepared = setup(undefined, [home(SECOND_HOME, ME)]);
    seedLikes(prepared, LIMIT / 2, MY_HOME);
    seedLikes(prepared, LIMIT / 2, SECOND_HOME);

    await expect(
      prepared.operations.likeHome(ME, { fromHomeId: SECOND_HOME, targetHomeId: THEIR_HOME }),
    ).rejects.toBeInstanceOf(DailyLikeLimitError);
  });

  it('los me gusta de ayer (hora de Madrid) no cuentan hoy', async () => {
    // 22:30 UTC de verano son las 00:30 del día siguiente en Madrid
    const prepared = setup(new Date('2026-10-19T22:30:00.000Z'));
    seedLikes(prepared, LIMIT, MY_HOME, new Date('2026-10-19T21:59:59.000Z'));

    await expect(
      prepared.operations.likeHome(ME, { fromHomeId: MY_HOME, targetHomeId: THEIR_HOME }),
    ).resolves.toEqual({ liked: true, match: null });
  });

  it('los me gusta de otro usuario no cuentan', async () => {
    const prepared = setup(undefined, [home('their-other', OTHER)]);
    seedLikes(prepared, LIMIT, 'their-other');

    await expect(
      prepared.operations.likeHome(ME, { fromHomeId: MY_HOME, targetHomeId: THEIR_HOME }),
    ).resolves.toEqual({ liked: true, match: null });
  });

  it('el día del cambio de hora de marzo, a las 00:30 de Madrid quedan 22,5 horas', async () => {
    const prepared = setup(new Date('2026-03-28T23:30:00.000Z'));
    seedLikes(prepared, LIMIT);

    await expect(
      prepared.operations.likeHome(ME, { fromHomeId: MY_HOME, targetHomeId: THEIR_HOME }),
    ).rejects.toMatchObject({ retryAfterSeconds: 22.5 * SECONDS_PER_HOUR });
  });

  it('el día del cambio de hora de octubre, a las 00:30 de Madrid quedan 24,5 horas', async () => {
    const prepared = setup(new Date('2026-10-24T22:30:00.000Z'));
    seedLikes(prepared, LIMIT);

    await expect(
      prepared.operations.likeHome(ME, { fromHomeId: MY_HOME, targetHomeId: THEIR_HOME }),
    ).rejects.toMatchObject({ retryAfterSeconds: 24.5 * SECONDS_PER_HOUR });
  });

  it('deshacer un me gusta devuelve el cupo del día', async () => {
    const prepared = setup(undefined, [home('home-c', OTHER)]);
    seedLikes(prepared, LIMIT - 1);
    await prepared.operations.likeHome(ME, { fromHomeId: MY_HOME, targetHomeId: THEIR_HOME });
    await expect(
      prepared.operations.likeHome(ME, { fromHomeId: MY_HOME, targetHomeId: 'home-c' }),
    ).rejects.toBeInstanceOf(DailyLikeLimitError);

    await prepared.operations.undoLastAction(ME, MY_HOME);

    await expect(
      prepared.operations.likeHome(ME, { fromHomeId: MY_HOME, targetHomeId: 'home-c' }),
    ).resolves.toEqual({ liked: true, match: null });
  });
});

describe('dismissHome', () => {
  it('Scenario: Descartar - desde una vivienda propia y publicada registra el descarte', async () => {
    const { operations, store, clock } = setup();

    await operations.dismissHome(ME, { fromHomeId: MY_HOME, targetHomeId: THEIR_HOME });

    expect(store.dismissals).toEqual([
      { origin: `home:${MY_HOME}`, to: THEIR_HOME, at: clock.current },
    ]);
  });

  it('Scenario: Descartar - un seeker descarta desde su cuenta, sin vivienda de origen', async () => {
    const { operations, store, clock } = setup();

    await operations.dismissHome('user-seeker', { targetHomeId: THEIR_HOME });

    expect(store.dismissals).toEqual([
      { origin: 'account:user-seeker', to: THEIR_HOME, at: clock.current },
    ]);
  });

  it('descartar dos veces es idempotente y renueva la fecha', async () => {
    const { operations, store, clock } = setup();
    await operations.dismissHome(ME, { fromHomeId: MY_HOME, targetHomeId: THEIR_HOME });
    clock.current = new Date('2026-10-20T08:00:00.000Z');

    await operations.dismissHome(ME, { fromHomeId: MY_HOME, targetHomeId: THEIR_HOME });

    expect(store.dismissals).toEqual([
      { origin: `home:${MY_HOME}`, to: THEIR_HOME, at: clock.current },
    ]);
  });

  it('un owner sin fromHomeId es una petición incompleta (400 sobre fromHomeId)', async () => {
    const { operations, store } = setup();

    const attempt = operations.dismissHome(ME, { targetHomeId: THEIR_HOME });

    await expect(attempt).rejects.toBeInstanceOf(OriginHomeRequiredError);
    await expect(attempt).rejects.toMatchObject({
      kind: 'invalid_request',
      fields: ['fromHomeId'],
    });
    expect(store.dismissals).toEqual([]);
  });

  it.each([
    ['ajena', THEIR_HOME],
    ['propia en borrador', 'home-draft'],
    ['inexistente', 'no-existe'],
  ])('un fromHomeId %s es 404', async (_name, fromHomeId) => {
    const { operations, store } = setup();

    await expect(
      operations.dismissHome(ME, { fromHomeId, targetHomeId: THEIR_HOME }),
    ).rejects.toBeInstanceOf(HomeNotFoundError);
    expect(store.dismissals).toEqual([]);
  });

  it.each([
    ['propia', SECOND_HOME],
    ['en borrador', 'their-draft'],
    ['inexistente', 'no-existe'],
  ])('descartar una vivienda %s es 404', async (_name, targetHomeId) => {
    const { operations, store } = setup(undefined, [home(SECOND_HOME, ME)]);

    await expect(
      operations.dismissHome(ME, { fromHomeId: MY_HOME, targetHomeId }),
    ).rejects.toBeInstanceOf(HomeNotFoundError);
    expect(store.dismissals).toEqual([]);
  });

  it.each(['their-draft', 'no-existe', 'home-draft'])(
    'un seeker que descarta la vivienda %s recibe 404',
    async (targetHomeId) => {
      const { operations, store } = setup();

      await expect(operations.dismissHome('user-seeker', { targetHomeId })).rejects.toBeInstanceOf(
        HomeNotFoundError,
      );
      expect(store.dismissals).toEqual([]);
    },
  );
});

describe('undoLastAction', () => {
  it('Scenario: Deshacer un descarte - el descarte deja de existir', async () => {
    const { operations, store } = setup();
    await operations.dismissHome(ME, { fromHomeId: MY_HOME, targetHomeId: THEIR_HOME });

    await operations.undoLastAction(ME, MY_HOME);

    expect(store.dismissals).toEqual([]);
  });

  it('deshace un me gusta reciente', async () => {
    const { operations, store } = setup();
    await operations.likeHome(ME, { fromHomeId: MY_HOME, targetHomeId: THEIR_HOME });

    await operations.undoLastAction(ME, MY_HOME);

    expect(store.likes).toEqual([]);
  });

  it('solo deshace la acción más reciente de esa vivienda', async () => {
    const { operations, store, clock } = setup(undefined, [home('home-c', OTHER)]);
    await operations.dismissHome(ME, { fromHomeId: MY_HOME, targetHomeId: 'home-c' });
    clock.current = new Date('2026-10-19T10:00:05.000Z');
    await operations.likeHome(ME, { fromHomeId: MY_HOME, targetHomeId: THEIR_HOME });

    await operations.undoLastAction(ME, MY_HOME);

    expect(store.likes).toEqual([]);
    expect(store.dismissals).toHaveLength(1);
  });

  it('no mezcla las acciones de otra vivienda del mismo usuario', async () => {
    const { operations, store, clock } = setup(undefined, [home(SECOND_HOME, ME)]);
    await operations.dismissHome(ME, { fromHomeId: MY_HOME, targetHomeId: THEIR_HOME });
    clock.current = new Date('2026-10-19T10:00:05.000Z');
    await operations.dismissHome(ME, { fromHomeId: SECOND_HOME, targetHomeId: THEIR_HOME });

    await operations.undoLastAction(ME, MY_HOME);

    expect(store.dismissals).toEqual([
      { origin: `home:${SECOND_HOME}`, to: THEIR_HOME, at: clock.current },
    ]);
  });

  it('un seeker deshace su último descarte de la cuenta', async () => {
    const { operations, store } = setup();
    await operations.dismissHome('user-seeker', { targetHomeId: THEIR_HOME });

    await operations.undoLastAction('user-seeker', undefined);

    expect(store.dismissals).toEqual([]);
  });

  it('sin ninguna acción responde 404', async () => {
    const { operations } = setup();

    await expect(operations.undoLastAction(ME, MY_HOME)).rejects.toBeInstanceOf(NothingToUndoError);
    await expect(operations.undoLastAction('user-seeker', undefined)).rejects.toBeInstanceOf(
      NothingToUndoError,
    );
  });

  it('una vivienda ajena o inexistente es 404 y un owner sin homeId es un 400', async () => {
    const { operations } = setup();

    await expect(operations.undoLastAction(ME, THEIR_HOME)).rejects.toBeInstanceOf(
      HomeNotFoundError,
    );
    await expect(operations.undoLastAction(ME, 'no-existe')).rejects.toBeInstanceOf(
      HomeNotFoundError,
    );
    const missing = operations.undoLastAction(ME, undefined);
    await expect(missing).rejects.toBeInstanceOf(OriginHomeRequiredError);
    await expect(missing).rejects.toMatchObject({ fields: ['homeId'] });
  });

  it('Scenario: No se deshace un match - un me gusta que forma parte de un match responde LIKE_IN_MATCH y se mantiene', async () => {
    const { operations, store, matches } = setup();
    await operations.likeHome(ME, { fromHomeId: MY_HOME, targetHomeId: THEIR_HOME });
    matches.inMatch.add(`${MY_HOME}>${THEIR_HOME}`);

    const undo = operations.undoLastAction(ME, MY_HOME);

    await expect(undo).rejects.toBeInstanceOf(LikeInMatchError);
    await expect(undo).rejects.toMatchObject({ code: 'LIKE_IN_MATCH', kind: 'conflict' });
    expect(store.likes).toHaveLength(1);
  });

  it('un descarte se deshace sin consultar los matches', async () => {
    const { operations, matches, store } = setup();
    await operations.dismissHome(ME, { fromHomeId: MY_HOME, targetHomeId: THEIR_HOME });
    matches.inMatch.add(`${MY_HOME}>${THEIR_HOME}`);

    await operations.undoLastAction(ME, MY_HOME);

    expect(store.dismissals).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';

import {
  FakeMatchLookup,
  InMemoryDecisionStore,
  InMemoryDecisionUnitOfWork,
  InMemoryHomeRepository,
  InMemoryMatchStore,
  InMemoryOutbox,
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
  const matching = new InMemoryMatchStore(store, homes);
  const matches = new FakeMatchLookup();
  const outbox = new InMemoryOutbox();
  let sequence = 0;
  const operations = decisionOperations({
    homes,
    units: new InMemoryDecisionUnitOfWork(store, matching, outbox),
    matches,
    clock: { now: () => clock.current },
    ids: { next: () => `match-${String(++sequence)}` },
    likesPerDay: LIMIT,
  });
  return { operations, homes, store, matching, matches, clock, outbox };
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

describe('likeHome con match directo', () => {
  const EUR = 100;
  const euros = (amount: number) => amount * EUR;

  /** Mis viviendas valen 200.000 € y la suya 212.000 €; cada dueño con los límites indicados. */
  function valued(
    myTerms: { maxToPayCents?: number; minToReceiveCents?: number } = {},
    theirTerms: { maxToPayCents?: number; minToReceiveCents?: number } = {},
  ) {
    const prepared = setup();
    const values = { [MY_HOME]: 200_000, [THEIR_HOME]: 212_000 };
    for (const [id, value] of Object.entries(values)) {
      const current = prepared.homes.homes.get(id);
      if (!current) throw new Error(`falta ${id}`);
      prepared.homes.homes.set(id, {
        ...current,
        valueMinCents: euros(value),
        valueMaxCents: euros(value),
      });
    }
    const terms = { maxToPayCents: euros(30_000), minToReceiveCents: 0, valueReferencePct: 50 };
    prepared.matching.terms.set(MY_HOME, { ...terms, ...myTerms });
    prepared.matching.terms.set(THEIR_HOME, { ...terms, ...theirTerms });
    prepared.matching.displayNames.set(ME, 'Ana');
    prepared.matching.displayNames.set(OTHER, 'Beto');
    return prepared;
  }

  const theyLikedMe = (prepared: Prepared) =>
    prepared.store.likes.push({
      from: THEIR_HOME,
      to: MY_HOME,
      at: new Date('2026-10-19T09:00:00.000Z'),
    });

  it('Scenario: Me gusta recíproco compatible - la respuesta incluye el match directo abierto con las dos viviendas', async () => {
    const prepared = valued();
    theyLikedMe(prepared);

    const result = await prepared.operations.likeHome(ME, {
      fromHomeId: MY_HOME,
      targetHomeId: THEIR_HOME,
    });

    expect(result).toEqual({
      liked: true,
      match: {
        id: 'match-1',
        type: 2,
        status: 'open',
        createdAt: '2026-10-19T10:00:00.000Z',
        participants: [
          {
            homeId: MY_HOME,
            displayName: 'Ana',
            givesHomeId: MY_HOME,
            receivesHomeId: THEIR_HOME,
            compensationCents: euros(12_000),
            status: 'pending',
          },
          {
            homeId: THEIR_HOME,
            displayName: 'Beto',
            givesHomeId: THEIR_HOME,
            receivesHomeId: MY_HOME,
            compensationCents: -euros(12_000),
            status: 'pending',
          },
        ],
      },
    });
    expect(prepared.matching.saved.map((match) => match.cycle.cycleKey)).toEqual([
      [MY_HOME, THEIR_HOME].sort().join(':'),
    ]);
    expect(prepared.store.likes).toHaveLength(2);
  });

  it('Scenario: Me gusta recíproco incompatible - se registra el me gusta y no se crea ningún match', async () => {
    const prepared = valued({ maxToPayCents: euros(10_000) });
    theyLikedMe(prepared);

    const result = await prepared.operations.likeHome(ME, {
      fromHomeId: MY_HOME,
      targetHomeId: THEIR_HOME,
    });

    expect(result).toEqual({ liked: true, match: null });
    expect(prepared.store.likes).toHaveLength(2);
    expect(prepared.matching.saved).toEqual([]);
  });

  it('Scenario: Vivienda ya no publicada - si la otra se pausa antes de que se lea dentro de la transacción, no hay match', async () => {
    const prepared = valued();
    theyLikedMe(prepared);
    prepared.matching.statusInTransaction.set(THEIR_HOME, 'paused');

    const result = await prepared.operations.likeHome(ME, {
      fromHomeId: MY_HOME,
      targetHomeId: THEIR_HOME,
    });

    expect(result).toEqual({ liked: true, match: null });
    expect(prepared.matching.saved).toEqual([]);
  });

  it('sin me gusta de vuelta no se busca ningún match', async () => {
    const prepared = valued();

    const result = await prepared.operations.likeHome(ME, {
      fromHomeId: MY_HOME,
      targetHomeId: THEIR_HOME,
    });

    expect(result).toEqual({ liked: true, match: null });
    expect(prepared.matching.saved).toEqual([]);
  });

  it('Scenario: Me gusta simultáneos - bloquea el par de viviendas, con su clave canónica, antes de comprobar y escribir', async () => {
    const prepared = valued();

    await prepared.operations.likeHome(ME, { fromHomeId: MY_HOME, targetHomeId: THEIR_HOME });

    expect(prepared.store.pairLocks).toEqual([[MY_HOME, THEIR_HOME].sort().join(':')]);
    expect(prepared.store.lockOrder).toEqual(['user', 'pair', 'insert']);
  });

  it('Scenario: Un solo match por ciclo - si el ciclo ya tenía match, devuelve el existente sin crear otro', async () => {
    const prepared = valued();
    theyLikedMe(prepared);
    await prepared.operations.likeHome(ME, { fromHomeId: MY_HOME, targetHomeId: THEIR_HOME });
    const [first] = prepared.matching.records;
    // Se borra la arista a mano para repetir el me gusta: el match del ciclo sigue existiendo
    await prepared.store.deleteLike(MY_HOME, THEIR_HOME);

    const again = await prepared.operations.likeHome(ME, {
      fromHomeId: MY_HOME,
      targetHomeId: THEIR_HOME,
    });

    expect(again.match?.id).toBe(first?.id);
    expect(prepared.matching.records).toHaveLength(1);
  });

  it('si algo falla tras crear el match, ni el me gusta ni el match quedan guardados', async () => {
    const prepared = valued();
    theyLikedMe(prepared);
    prepared.matching.failOnFind = true;

    await expect(
      prepared.operations.likeHome(ME, { fromHomeId: MY_HOME, targetHomeId: THEIR_HOME }),
    ).rejects.toThrow();

    expect(prepared.store.likes).toHaveLength(1);
    expect(prepared.matching.records).toEqual([]);
  });

  it('Scenario: Chat creado con el match - el match nuevo deja un hecho match.created en la bandeja de salida', async () => {
    const prepared = valued();
    theyLikedMe(prepared);

    const result = await prepared.operations.likeHome(ME, {
      fromHomeId: MY_HOME,
      targetHomeId: THEIR_HOME,
    });

    expect(prepared.outbox.events).toEqual([
      {
        id: 'match-2',
        type: 'match.created',
        aggregateId: result.match?.id,
        attempts: 0,
        processedAt: null,
      },
    ]);
  });

  it('un me gusta que no forma match no deja ningún hecho, y repetir el de un ciclo ya creado no añade otro', async () => {
    const lonely = valued();
    await lonely.operations.likeHome(ME, { fromHomeId: MY_HOME, targetHomeId: THEIR_HOME });
    expect(lonely.outbox.events).toEqual([]);

    const prepared = valued();
    theyLikedMe(prepared);
    await prepared.operations.likeHome(ME, { fromHomeId: MY_HOME, targetHomeId: THEIR_HOME });
    await prepared.store.deleteLike(MY_HOME, THEIR_HOME);
    await prepared.operations.likeHome(ME, { fromHomeId: MY_HOME, targetHomeId: THEIR_HOME });
    expect(prepared.outbox.events).toHaveLength(1);
  });

  it('si algo falla tras crear el match, el hecho de la bandeja de salida se deshace con la transacción', async () => {
    const prepared = valued();
    theyLikedMe(prepared);
    prepared.matching.failOnFind = true;

    await expect(
      prepared.operations.likeHome(ME, { fromHomeId: MY_HOME, targetHomeId: THEIR_HOME }),
    ).rejects.toThrow();

    expect(prepared.outbox.events).toEqual([]);
  });

  it('deshacer un me gusta bloquea antes el par de viviendas, para no cruzarse con el match que lo usa', async () => {
    const prepared = valued();
    await prepared.operations.likeHome(ME, { fromHomeId: MY_HOME, targetHomeId: THEIR_HOME });
    prepared.store.pairLocks.length = 0;

    await prepared.operations.undoLastAction(ME, MY_HOME);

    expect(prepared.store.pairLocks).toEqual([[MY_HOME, THEIR_HOME].sort().join(':')]);
  });
});

describe('likeHome con match en cadena', () => {
  const EUR = 100;
  const euros = (amount: number) => amount * EUR;
  const THIRD = 'user-third';
  const FOURTH = 'user-fourth';
  const THIRD_HOME = 'home-third';
  const FOURTH_HOME = 'home-fourth';
  const OPEN = { maxToPayCents: euros(50_000), minToReceiveCents: 0, valueReferencePct: 50 };

  /**
   * A (mía, 200.000 €), B (de Beto, 210.000 €), C (de Carla, 230.000 €) y D (de Dani, 215.000 €),
   * con límites amplios salvo los indicados. En la cadena A → B → C → A, Ana paga 10.000 €, Beto
   * paga 20.000 € y Carla recibe 30.000 €.
   */
  function chainSetup(limits: Record<string, Partial<typeof OPEN>> = {}) {
    const prepared = setup(undefined, [home(THIRD_HOME, THIRD), home(FOURTH_HOME, FOURTH)]);
    const values = {
      [MY_HOME]: 200_000,
      [THEIR_HOME]: 210_000,
      [THIRD_HOME]: 230_000,
      [FOURTH_HOME]: 215_000,
    };
    for (const [id, value] of Object.entries(values)) {
      const current = prepared.homes.homes.get(id);
      if (!current) throw new Error(`falta ${id}`);
      prepared.homes.homes.set(id, {
        ...current,
        valueMinCents: euros(value),
        valueMaxCents: euros(value),
      });
      prepared.matching.terms.set(id, { ...OPEN, ...limits[id] });
    }
    return prepared;
  }

  const liked = (prepared: Prepared, from: string, to: string, at = '2026-10-19T09:00:00.000Z') =>
    prepared.store.likes.push({ from, to, at: new Date(at) });

  const likeB = (prepared: Prepared) =>
    prepared.operations.likeHome(ME, { fromHomeId: MY_HOME, targetHomeId: THEIR_HOME });

  it('Scenario: Cadena compatible - el me gusta que cierra A → B → C → A crea el match de tres, con suma 0', async () => {
    const prepared = chainSetup();
    liked(prepared, THEIR_HOME, THIRD_HOME);
    liked(prepared, THIRD_HOME, MY_HOME);

    const { match } = await likeB(prepared);

    expect(match).toMatchObject({ id: 'match-1', type: 3, status: 'open' });
    expect(match?.participants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          homeId: MY_HOME,
          receivesHomeId: THEIR_HOME,
          compensationCents: euros(10_000),
        }),
        expect.objectContaining({
          homeId: THEIR_HOME,
          receivesHomeId: THIRD_HOME,
          compensationCents: euros(20_000),
        }),
        expect.objectContaining({
          homeId: THIRD_HOME,
          receivesHomeId: MY_HOME,
          compensationCents: -euros(30_000),
        }),
      ]),
    );
    const total = match?.participants.reduce((sum, p) => sum + p.compensationCents, 0);
    expect(total).toBe(0);
    expect(prepared.matching.saved.map((saved) => saved.cycle.cycleKey)).toEqual([
      [MY_HOME, THEIR_HOME, THIRD_HOME].sort().join(':'),
    ]);
  });

  it('Scenario: Un eslabón incompatible - si Carla no acepta recibir tan poco, no hay match', async () => {
    const prepared = chainSetup({ [THIRD_HOME]: { minToReceiveCents: euros(40_000) } });
    liked(prepared, THEIR_HOME, THIRD_HOME);
    liked(prepared, THIRD_HOME, MY_HOME);

    expect(await likeB(prepared)).toEqual({ liked: true, match: null });
    expect(prepared.matching.saved).toEqual([]);
  });

  it('Scenario: Nunca más de tres - un ciclo de cuatro viviendas no forma match', async () => {
    const prepared = chainSetup();
    liked(prepared, THEIR_HOME, THIRD_HOME);
    liked(prepared, THIRD_HOME, FOURTH_HOME);
    liked(prepared, FOURTH_HOME, MY_HOME);

    expect(await likeB(prepared)).toEqual({ liked: true, match: null });
    expect(prepared.matching.saved).toEqual([]);
  });

  it('Scenario: Directo y en cadena a la vez - se crea el directo, una sola vez, y no además la cadena con las mismas viviendas', async () => {
    const prepared = chainSetup();
    liked(prepared, THEIR_HOME, MY_HOME);
    liked(prepared, THEIR_HOME, THIRD_HOME);
    liked(prepared, THIRD_HOME, MY_HOME);

    const { match } = await likeB(prepared);

    expect(match).toMatchObject({ type: 2 });
    expect(prepared.matching.saved.map((saved) => saved.cycle.cycleKey)).toEqual([
      [MY_HOME, THEIR_HOME].sort().join(':'),
    ]);
  });

  it('si el directo no es aceptable, se crea la cadena', async () => {
    // En el directo Beto recibiría 10.000 € y pide al menos 15.000 €; en la cadena paga
    const prepared = chainSetup({ [THEIR_HOME]: { minToReceiveCents: euros(15_000) } });
    liked(prepared, THEIR_HOME, MY_HOME);
    liked(prepared, THEIR_HOME, THIRD_HOME);
    liked(prepared, THIRD_HOME, MY_HOME);

    const { match } = await likeB(prepared);

    expect(match).toMatchObject({ type: 3 });
    expect(prepared.matching.saved).toHaveLength(1);
  });

  it('con varias cadenas, crea solo la primera aceptable en el orden de los candidatos', async () => {
    // A → B → D → A espera desde antes, pero Dani no acepta recibir tan poco: se crea A → B → C → A
    const prepared = chainSetup({ [FOURTH_HOME]: { minToReceiveCents: euros(40_000) } });
    liked(prepared, THEIR_HOME, FOURTH_HOME, '2026-10-18T09:00:00.000Z');
    liked(prepared, FOURTH_HOME, MY_HOME, '2026-10-18T09:00:00.000Z');
    liked(prepared, THEIR_HOME, THIRD_HOME);
    liked(prepared, THIRD_HOME, MY_HOME);

    const { match } = await likeB(prepared);

    expect(match?.participants.map((p) => p.homeId).sort()).toEqual(
      [MY_HOME, THEIR_HOME, THIRD_HOME].sort(),
    );
    expect(prepared.matching.saved).toHaveLength(1);
  });

  it('una tercera vivienda de uno de los otros dos propietarios no forma cadena', async () => {
    const prepared = chainSetup();
    // La de Carla pasa a ser mía: Ana ocuparía dos eslabones
    const third = prepared.homes.homes.get(THIRD_HOME);
    if (!third) throw new Error('falta la tercera');
    prepared.homes.homes.set(THIRD_HOME, { ...third, ownerId: ME });
    liked(prepared, THEIR_HOME, THIRD_HOME);
    liked(prepared, THIRD_HOME, MY_HOME);

    expect(await likeB(prepared)).toEqual({ liked: true, match: null });
    expect(prepared.matching.saved).toEqual([]);
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

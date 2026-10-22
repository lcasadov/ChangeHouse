import { fakeChainMatch, fakeMatch } from '../../test-support/fake-matches';
import {
  chainThirdHomeIdOf,
  compensationOf,
  cycleOf,
  kindOf,
  linksOf,
  matchViewOf,
} from './match-model';

describe('compensationOf', () => {
  it.each([
    [1_200_000, { kind: 'pay', amountCents: 1_200_000 }],
    [-800_000, { kind: 'receive', amountCents: 800_000 }],
    [0, { kind: 'fair', amountCents: 0 }],
  ] as const)('%d céntimos de compensación son %j', (cents, expected) => {
    expect(compensationOf(cents)).toEqual(expected);
  });
});

describe('kindOf', () => {
  it('un match de dos casas es directo y uno de tres es en cadena', () => {
    expect(kindOf(2)).toBe('direct');
    expect(kindOf(3)).toBe('chain');
  });
});

describe('matchViewOf', () => {
  const MINE = 'home-mine';
  const THEIRS = 'home-theirs';

  it('la casa del otro es la que recibo y la compensación es la mía', () => {
    const match = fakeMatch({ mineHomeId: MINE, theirHomeId: THEIRS, compensationCents: 500_000 });

    expect(matchViewOf(match, new Set([MINE]))).toEqual({
      otherHomeId: THEIRS,
      compensation: { kind: 'pay', amountCents: 500_000 },
    });
  });

  it('reconoce mi participación aunque aparezca la segunda', () => {
    const match = fakeMatch({ mineHomeId: THEIRS, theirHomeId: MINE, compensationCents: 500_000 });

    expect(matchViewOf(match, new Set([MINE]))).toEqual({
      otherHomeId: THEIRS,
      compensation: { kind: 'receive', amountCents: 500_000 },
    });
  });

  it('si ninguna casa es mía no hay compensación que mostrar y se enseña la primera', () => {
    const match = fakeMatch({ mineHomeId: MINE, theirHomeId: THEIRS });

    expect(matchViewOf(match, new Set())).toEqual({ otherHomeId: MINE, compensation: null });
  });
});

describe('match en cadena', () => {
  // Los identificadores no siguen el orden del ciclo: la API ordena por vivienda, no por ciclo
  const A = 'home-c';
  const B = 'home-a';
  const C = 'home-b';
  const chain = fakeChainMatch({ mineHomeId: A, fromHomeId: B, toHomeId: C });
  const names = (list: readonly ({ displayName: string } | undefined)[]) =>
    list.map((participant) => participant?.displayName);

  it('la API devuelve los participantes por vivienda, no en el orden del ciclo', () => {
    expect(chain.participants.map((participant) => participant.homeId)).toEqual([B, C, A]);
  });

  it('cycleOf reconstruye el ciclo empezando por quien mira: yo, de quien recibo y a quien entrego', () => {
    expect(names(cycleOf(chain.participants, new Set([A])))).toEqual(['Ana', 'Beto', 'Carla']);
    expect(names(cycleOf(chain.participants, new Set([B])))).toEqual(['Beto', 'Carla', 'Ana']);
  });

  it('cycleOf sin saber cuál es mi participación empieza por la primera', () => {
    expect(names(cycleOf(chain.participants, new Set()))).toEqual(['Beto', 'Carla', 'Ana']);
  });

  it('cycleOf deja un match directo como llegó, empezando por mí', () => {
    const direct = fakeMatch({ mineHomeId: A, theirHomeId: B });

    expect(names(cycleOf(direct.participants, new Set([A])))).toEqual(['Ana', 'Beto']);
  });

  it('cycleOf conserva el orden recibido si los eslabones no cierran un ciclo', () => {
    const broken = chain.participants.map((participant) => ({
      ...participant,
      receivesHomeId: 'home-fuera',
    }));

    expect(cycleOf(broken, new Set([A]))).toEqual(broken);
  });

  it('linksOf dice de quién recibe y a quién entrega cada participante', () => {
    const ana = chain.participants.find((participant) => participant.homeId === A);
    const beto = chain.participants.find((participant) => participant.homeId === B);

    expect(
      ana && names([linksOf(chain.participants, ana).from, linksOf(chain.participants, ana).to]),
    ).toEqual(['Beto', 'Carla']);
    expect(
      beto && names([linksOf(chain.participants, beto).from, linksOf(chain.participants, beto).to]),
    ).toEqual(['Carla', 'Ana']);
  });

  it('en la lista la otra casa es la que recibo y la tercera la de quien recibe la mía', () => {
    expect(matchViewOf(chain, new Set([A])).otherHomeId).toBe(B);
    expect(chainThirdHomeIdOf(chain, new Set([A]))).toBe(C);
  });

  it('la compensación de la lista es la mía', () => {
    expect(matchViewOf(chain, new Set([A])).compensation).toEqual({
      kind: 'pay',
      amountCents: 600_000,
    });
  });

  it('un match directo o sin saber cuál es mi casa no tiene tercera casa', () => {
    expect(
      chainThirdHomeIdOf(fakeMatch({ mineHomeId: A, theirHomeId: B }), new Set([A])),
    ).toBeUndefined();
    expect(chainThirdHomeIdOf(chain, new Set())).toBeUndefined();
  });
});

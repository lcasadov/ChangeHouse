import { fakeMatch } from '../../test-support/fake-matches';
import { compensationOf, kindOf, matchViewOf } from './match-model';

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

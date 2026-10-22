import { discoveryCard } from '../../test-support/fake-discovery';
import {
  homeOptions,
  PREFETCH_THRESHOLD,
  shouldLoadMore,
  uniqueCards,
  withoutDecided,
} from './feed-model';

describe('uniqueCards', () => {
  it('junta las páginas en orden y descarta las tarjetas repetidas', () => {
    const [a, b, c] = [discoveryCard(), discoveryCard(), discoveryCard()];
    if (!a || !b || !c) throw new Error('fixture');

    const cards = uniqueCards([
      { items: [a, b], nextCursor: 'x' },
      { items: [b, c, a], nextCursor: null },
    ]);

    expect(cards.map((card) => card.id)).toEqual([a.id, b.id, c.id]);
  });

  it('sin páginas no hay tarjetas', () => {
    expect(uniqueCards(undefined)).toEqual([]);
    expect(uniqueCards([])).toEqual([]);
  });
});

describe('withoutDecided', () => {
  it('quita las tarjetas ya decididas y conserva el orden del resto', () => {
    const [a, b, c] = [discoveryCard(), discoveryCard(), discoveryCard()];
    if (!a || !b || !c) throw new Error('fixture');

    const cards = withoutDecided([a, b, c], new Set([a.id, c.id]));

    expect(cards).toEqual([b]);
  });

  it('sin nada decidido devuelve todas', () => {
    const [a, b] = [discoveryCard(), discoveryCard()];
    if (!a || !b) throw new Error('fixture');

    expect(withoutDecided([a, b], new Set())).toEqual([a, b]);
  });
});

describe('shouldLoadMore', () => {
  const base = { remaining: PREFETCH_THRESHOLD, hasNextPage: true, busy: false, failed: false };

  it('pide la siguiente página al quedar 3 tarjetas', () => {
    expect(PREFETCH_THRESHOLD).toBe(3);
    expect(shouldLoadMore(base)).toBe(true);
    expect(shouldLoadMore({ ...base, remaining: 1 })).toBe(true);
    expect(shouldLoadMore({ ...base, remaining: 0 })).toBe(true);
  });

  it('no la pide mientras quedan más de 3', () => {
    expect(shouldLoadMore({ ...base, remaining: PREFETCH_THRESHOLD + 1 })).toBe(false);
  });

  it.each([
    ['no hay más páginas', { hasNextPage: false }],
    ['ya hay una petición en curso', { busy: true }],
    ['la última petición falló (se reintenta a mano)', { failed: true }],
  ])('no la pide si %s', (_name, change) => {
    expect(shouldLoadMore({ ...base, ...change })).toBe(false);
  });
});

describe('homeOptions', () => {
  const titleOf = (home: { area: string }) => `Piso en ${home.area}`;

  it('usa el título de cada vivienda', () => {
    const options = homeOptions(
      [
        { id: 'a', area: 'Malasaña' },
        { id: 'b', area: 'Chamberí' },
      ],
      titleOf,
    );

    expect(options).toEqual([
      { value: 'a', label: 'Piso en Malasaña' },
      { value: 'b', label: 'Piso en Chamberí' },
    ]);
  });

  it('numera las viviendas con el mismo título para poder distinguirlas', () => {
    const options = homeOptions(
      [
        { id: 'a', area: 'Malasaña' },
        { id: 'b', area: 'Chamberí' },
        { id: 'c', area: 'Malasaña' },
        { id: 'd', area: 'Malasaña' },
      ],
      titleOf,
    );

    expect(options.map((option) => option.label)).toEqual([
      'Piso en Malasaña (1)',
      'Piso en Chamberí',
      'Piso en Malasaña (2)',
      'Piso en Malasaña (3)',
    ]);
  });
});

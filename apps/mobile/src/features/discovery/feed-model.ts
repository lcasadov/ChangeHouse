import type { ChoiceOption } from '../../ui';
import type { DiscoveryCard, DiscoveryPage } from './discovery-api';

/** Con tantas tarjetas por ver (la que se ve incluida) se pide ya la página siguiente. */
export const PREFETCH_THRESHOLD = 3;

/** Las tarjetas de todas las páginas cargadas, en orden y sin repetir ninguna. */
export function uniqueCards(pages: readonly DiscoveryPage[] | undefined): DiscoveryCard[] {
  const seen = new Set<string>();
  const cards: DiscoveryCard[] = [];
  for (const card of (pages ?? []).flatMap((page) => page.items)) {
    if (!seen.has(card.id)) {
      seen.add(card.id);
      cards.push(card);
    }
  }
  return cards;
}

/** Las tarjetas que aún no se han decidido, en el mismo orden. */
export function withoutDecided(
  cards: readonly DiscoveryCard[],
  decided: ReadonlySet<string>,
): DiscoveryCard[] {
  return cards.filter((card) => !decided.has(card.id));
}

export interface LoadMoreState {
  /** Tarjetas por ver, contando la que está a la vista. */
  remaining: number;
  hasNextPage: boolean;
  /** Ya hay una petición en curso. */
  busy: boolean;
  /** La última petición de página falló: se reintenta con una acción, no en bucle. */
  failed: boolean;
}

export function shouldLoadMore({ remaining, hasNextPage, busy, failed }: Readonly<LoadMoreState>) {
  return hasNextPage && !busy && !failed && remaining <= PREFETCH_THRESHOLD;
}

/**
 * Las opciones del selector de vivienda. Dos viviendas con el mismo título (mismo tipo y barrio) se
 * numeran para que se puedan distinguir.
 */
export function homeOptions<T extends { id: string }>(
  homes: readonly T[],
  titleOf: (home: T) => string,
): ChoiceOption<string>[] {
  const titles = homes.map(titleOf);
  const total = (title: string) => titles.filter((other) => other === title).length;
  const counted = new Map<string, number>();
  return homes.map((home, index) => {
    const title = titles[index] ?? '';
    const position = (counted.get(title) ?? 0) + 1;
    counted.set(title, position);
    return {
      value: home.id,
      label: total(title) > 1 ? `${title} (${String(position)})` : title,
    };
  });
}

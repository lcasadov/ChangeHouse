import type { TFunction } from 'i18next';

import { photosOf } from '../homes/home-photos';
import { homeTitleOf } from '../homes/home-title';
import { compensationText } from './CompensationPill';
import type { DiscoveryCard, PublicHome } from './discovery-api';

/** Lo que se cuenta de la vivienda en una línea cada cosa: metros, dormitorios y baños (los que consten). */
export function factsOf(
  t: TFunction,
  home: Pick<PublicHome, 'usefulM2' | 'builtM2' | 'bedrooms' | 'bathrooms'>,
): { key: 'm2' | 'bedrooms' | 'bathrooms'; text: string }[] {
  const area = home.usefulM2 ?? home.builtM2;
  return [
    ...(area === null
      ? []
      : [{ key: 'm2' as const, text: t('discovery.card.m2', { value: area }) }]),
    ...(home.bedrooms === null
      ? []
      : [
          {
            key: 'bedrooms' as const,
            text: t('discovery.card.bedrooms', { count: home.bedrooms }),
          },
        ]),
    ...(home.bathrooms === null
      ? []
      : [
          {
            key: 'bathrooms' as const,
            text: t('discovery.card.bathrooms', { count: home.bathrooms }),
          },
        ]),
  ];
}

/**
 * El resumen que lee un lector de pantalla al llegar a la tarjeta: todo lo que ve quien mira, en el
 * orden en que importa (qué casa, cuánto cuesta el cambio y qué foto está viendo).
 */
export function cardSummary(t: TFunction, card: DiscoveryCard, position: number): string {
  const photos = photosOf(card);
  return [
    homeTitleOf(t, card),
    factsOf(t, card)
      .map((fact) => fact.text)
      .join(', '),
    card.compensation ? compensationText(t, card.compensation) : '',
    card.compensation ? t('discovery.compensation.disclaimer') : '',
    photos.length > 0 ? t('discovery.photos.position', { position, total: photos.length }) : '',
  ]
    .filter((part) => part !== '')
    .join('. ');
}

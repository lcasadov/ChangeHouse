import type { TFunction } from 'i18next';

import type { Home } from './homes-api';

/** El título de una vivienda a partir de su tipo y su barrio o zona (nunca la dirección). */
export function homeTitleOf(t: TFunction, home: Pick<Home, 'type' | 'location'>): string {
  return t('homes.card.title', {
    type: t(`homes.type.${home.type}`),
    area: home.location.areaName,
  });
}

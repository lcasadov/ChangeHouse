import { useTranslation } from 'react-i18next';

import { ChoiceChips } from '../../ui';
import { homeTitleOf } from '../homes/home-title';
import type { Home } from '../homes/homes-api';
import { homeOptions } from './feed-model';

export interface HomeSelectorProps {
  /** Las viviendas propias publicadas (más de una). */
  homes: readonly Home[];
  /** La vivienda desde la que se busca. */
  value: string | undefined;
  onChange: (homeId: string) => void;
}

/** Elegir desde cuál de sus viviendas publicadas busca el propietario: cada una tiene su compensación. */
export function HomeSelector({ homes, value, onChange }: Readonly<HomeSelectorProps>) {
  const { t } = useTranslation();
  return (
    <ChoiceChips
      label={t('discovery.homeSelector.label')}
      options={homeOptions(homes, (home) => homeTitleOf(t, home))}
      value={value ?? ''}
      onChange={onChange}
    />
  );
}

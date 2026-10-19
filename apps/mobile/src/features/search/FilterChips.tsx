import { HOME_TYPES } from '@changehouse/shared';
import { useTheme } from '@changehouse/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { Button, Chip } from '../../ui';
import {
  type FlagFilter,
  nextMinBedrooms,
  type Preferences,
  toggleFlag,
  toggleType,
} from './preferences';

export interface FilterChipsProps {
  preferences: Preferences;
  /** El documento con el filtro cambiado. */
  onChange: (next: Preferences) => void;
  /** Abre la hoja «Filtros y compensación». */
  onMore: () => void;
}

const FLAG_CHIPS: readonly FlagFilter[] = ['garage', 'lift', 'exterior'];

/**
 * La fila de filtros de un toque: Garaje, Ascensor, Exterior, Dormitorios ≥ n y Tipo, más el acceso
 * a la hoja con el resto. Cada chip anuncia si está seleccionado; «Tipo» despliega sus opciones.
 */
export function FilterChips({ preferences, onChange, onMore }: Readonly<FilterChipsProps>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [typesOpen, setTypesOpen] = useState(false);
  const filters = preferences.filters ?? {};
  const bedrooms = filters.minBedrooms;
  const types = filters.types ?? [];

  return (
    <View style={{ gap: theme.space[2] }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityLabel={t('search.chips.label')}
        contentContainerStyle={{ gap: theme.space[2], paddingVertical: theme.space[1] }}
      >
        {FLAG_CHIPS.map((flag) => (
          <Chip
            key={flag}
            kind="toggle"
            label={t(`search.chips.${flag}`)}
            selected={filters[flag] === true}
            onChange={() => {
              onChange(toggleFlag(preferences, flag));
            }}
          />
        ))}
        <Chip
          kind="toggle"
          label={
            bedrooms === undefined
              ? t('search.chips.bedrooms')
              : t('search.chips.bedroomsMin', { count: bedrooms })
          }
          selected={bedrooms !== undefined}
          onChange={() => {
            onChange(nextMinBedrooms(preferences));
          }}
        />
        <Chip
          kind="toggle"
          label={t('search.chips.type')}
          selected={types.length > 0}
          expanded={typesOpen}
          onChange={() => {
            setTypesOpen((open) => !open);
          }}
        />
        <Button variant="ghost" label={t('search.chips.more')} onPress={onMore} />
      </ScrollView>
      {typesOpen ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2] }}>
          {HOME_TYPES.map((type) => (
            <Chip
              key={type}
              label={t(`homes.type.${type}`)}
              selected={types.includes(type)}
              onChange={() => {
                onChange(toggleType(preferences, type));
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

import { useTheme } from '@changehouse/ui';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Text } from '../../ui';
import { decimalFieldText, FEATURE_FLAGS, formatEuros } from './home-form';
import type { Home } from './homes-api';

interface RowProps {
  label: string;
  value: string;
}

function Row({ label, value }: Readonly<RowProps>) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.space[1] }}>
      <Text variant="caption" tone="textMuted">
        {label}
      </Text>
      <Text>{value}</Text>
    </View>
  );
}

/** Lo que se sabe de una vivienda, para la revisión final y el detalle del propietario. */
export function HomeSummary({ home }: Readonly<{ home: Home }>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const pending = t('homes.summary.pending');
  const yesNo = (value: boolean | null | undefined) =>
    value === null || value === undefined
      ? pending
      : t(value ? 'homes.summary.yes' : 'homes.summary.no');
  const known = (...values: (number | null)[]) => values.every((value) => value !== null);

  const features = home.features ?? {};
  const extras = [
    ...FEATURE_FLAGS.filter((flag) => features[flag] === true).map((flag) =>
      t(`homes.features.${flag}`),
    ),
    ...(features.heating ? [t(`homes.heating.${features.heating}`)] : []),
    ...(features.condition ? [t(`homes.condition.${features.condition}`)] : []),
  ];

  return (
    <View style={{ gap: theme.space[3] }}>
      <Row label={t('homes.summary.address')} value={home.address} />
      <Row label={t('homes.summary.area')} value={home.location.areaName} />
      <Row
        label={t('homes.summary.visibility')}
        value={t(`homes.location.${home.location.visibility}`)}
      />
      <Row
        label={t('homes.summary.surfaces')}
        value={
          known(home.usefulM2, home.builtM2)
            ? t('homes.summary.surfacesValue', {
                useful: decimalFieldText(home.usefulM2),
                built: decimalFieldText(home.builtM2),
              })
            : pending
        }
      />
      <Row
        label={t('homes.summary.rooms')}
        value={
          known(home.bedrooms, home.bathrooms)
            ? t('homes.summary.roomsValue', { bedrooms: home.bedrooms, bathrooms: home.bathrooms })
            : pending
        }
      />
      {home.floor ? <Row label={t('homes.summary.floor')} value={home.floor} /> : null}
      <Row label={t('homes.fields.hasLift')} value={yesNo(home.hasLift)} />
      <Row label={t('homes.fields.garage')} value={yesNo(home.garage)} />
      <Row label={t('homes.fields.storageRoom')} value={yesNo(home.storageRoom)} />
      <Row label={t('homes.summary.extras')} value={extras.join(', ') || pending} />
      {home.energyRating ? (
        <Row label={t('homes.summary.energyRating')} value={home.energyRating} />
      ) : null}
      {home.yearBuilt ? (
        <Row label={t('homes.summary.yearBuilt')} value={String(home.yearBuilt)} />
      ) : null}
      <Row
        label={t('homes.summary.value')}
        value={
          known(home.valueMinCents, home.valueMaxCents)
            ? t('homes.card.value', {
                min: formatEuros(home.valueMinCents ?? 0),
                max: formatEuros(home.valueMaxCents ?? 0),
              })
            : pending
        }
      />
      {home.mortgageOutstandingCents === null ||
      home.mortgageOutstandingCents === undefined ? null : (
        <Row
          label={t('homes.summary.mortgage')}
          value={formatEuros(home.mortgageOutstandingCents)}
        />
      )}
      <Row
        label={t('homes.summary.photos')}
        value={t('homes.photos.counter', { count: home.photos?.length ?? 0 })}
      />
      <Row label={t('homes.summary.primaryResidence')} value={yesNo(home.isPrimaryResidence)} />
    </View>
  );
}

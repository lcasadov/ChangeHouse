import { borderWidth, useTheme } from '@changehouse/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { Button, EmptyState, Notice, Text, TextField } from '../../ui';
import { AdminApiError, type Metrics } from './admin-api';
import { AdminScreen } from './AdminScreen';
import { DataTable } from './DataTable';
import { defaultPeriod, isIsoDate, type Period } from './period';
import { useMetrics } from './use-admin-panel';

type FieldError = 'format' | 'range';

function TotalCard({ label, value }: Readonly<{ label: string; value: number }>) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={t('admin.metrics.totalLabel', { label, value })}
      style={{
        backgroundColor: theme.color.surface,
        borderColor: theme.color.border,
        borderRadius: theme.radius.lg,
        borderWidth: borderWidth.thin,
        flexBasis: '45%',
        flexGrow: 1,
        gap: theme.space[1],
        padding: theme.space[4],
      }}
    >
      <Text variant="caption" tone="textMuted">
        {label}
      </Text>
      <Text variant="title">{String(value)}</Text>
    </View>
  );
}

function Results({ metrics }: Readonly<{ metrics: Metrics }>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const totals: [string, number][] = [
    [t('admin.metrics.totals.signups'), metrics.signups],
    [t('admin.metrics.totals.likes'), metrics.likes],
    [t('admin.metrics.totals.direct'), metrics.matches.direct],
    [t('admin.metrics.totals.chain'), metrics.matches.chain],
    [t('admin.metrics.totals.operations'), metrics.operations],
  ];
  return (
    <View style={{ gap: theme.space[4] }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[3] }}>
        {totals.map(([label, value]) => (
          <TotalCard key={label} label={label} value={value} />
        ))}
      </View>
      <Text variant="heading" accessibilityRole="header">
        {t('admin.metrics.zones.title')}
      </Text>
      {metrics.publishedHomesByZone.length === 0 ? (
        <Text tone="textMuted">{t('admin.metrics.zones.empty')}</Text>
      ) : (
        <DataTable
          items={metrics.publishedHomesByZone}
          keyOf={(row) => row.zone}
          columns={[
            { key: 'zone', header: t('admin.metrics.zones.zone'), value: (row) => row.zone },
            {
              key: 'count',
              header: t('admin.metrics.zones.count'),
              value: (row) => String(row.count),
            },
          ]}
        />
      )}
    </View>
  );
}

/**
 * «Métricas» de «Administración»: totales del producto en un periodo (por defecto, el mes en curso)
 * y las viviendas publicadas por zona. Si la API rechaza el periodo por invertido, se señalan las
 * dos fechas.
 */
export function MetricsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const [initial] = useState(() => defaultPeriod(new Date()));
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [period, setPeriod] = useState<Period>(initial);
  const [formatErrors, setFormatErrors] = useState<{ from?: FieldError; to?: FieldError }>({});
  const query = useMetrics(period);

  const rejected = query.error instanceof AdminApiError && query.error.kind === 'invalid';
  const errorOf = (field: 'from' | 'to') => {
    const kind = formatErrors[field] ?? (rejected ? 'range' : undefined);
    return kind ? t(`admin.metrics.errors.${kind}`) : undefined;
  };

  const submit = () => {
    const next = {
      ...(isIsoDate(from) ? {} : { from: 'format' as const }),
      ...(isIsoDate(to) ? {} : { to: 'format' as const }),
    };
    setFormatErrors(next);
    if (Object.keys(next).length === 0) setPeriod({ from, to });
  };

  let body = null;
  if (query.isPending) {
    body = (
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={t('admin.panel.loading')}
        accessibilityLiveRegion="polite"
        style={{ padding: theme.space[5] }}
      >
        <ActivityIndicator size="large" color={theme.color.primary} />
      </View>
    );
  } else if (query.data) {
    body = <Results metrics={query.data} />;
  } else if (rejected) {
    body = (
      <EmptyState
        icon="calendar-outline"
        title={t('admin.metrics.invalid.title')}
        description={t('admin.metrics.invalid.description')}
      />
    );
  } else {
    body = (
      <Notice
        tone="danger"
        action={{
          label: t('admin.metrics.retry'),
          onPress: () => {
            query.refetch().catch(() => undefined);
          },
        }}
      >
        {t('admin.metrics.errors.loadFailed')}
      </Notice>
    );
  }

  return (
    <AdminScreen>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: theme.space[4], paddingVertical: theme.space[5] }}
      >
        <View style={{ gap: theme.space[1] }}>
          <Text variant="title" accessibilityRole="header">
            {t('admin.metrics.title')}
          </Text>
          <Text tone="textMuted">{t('admin.metrics.intro')}</Text>
        </View>
        <TextField
          label={t('admin.metrics.from')}
          hint={t('admin.metrics.hint')}
          value={from}
          onChangeText={setFrom}
          keyboardType="numbers-and-punctuation"
          error={errorOf('from')}
        />
        <TextField
          label={t('admin.metrics.to')}
          hint={t('admin.metrics.hint')}
          value={to}
          onChangeText={setTo}
          keyboardType="numbers-and-punctuation"
          error={errorOf('to')}
        />
        <Button label={t('admin.metrics.submit')} loading={query.isFetching} onPress={submit} />
        {body}
      </ScrollView>
    </AdminScreen>
  );
}

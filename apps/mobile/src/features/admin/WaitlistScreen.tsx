import { useTheme } from '@changehouse/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { Button, Notice, Text, TextField } from '../../ui';
import { useServices } from '../session/services';
import type { WaitlistEntry } from './admin-api';
import { AdminScreen } from './AdminScreen';
import { DataTable } from './DataTable';
import { formatDate } from './format-date';
import { PagedSection } from './PagedSection';
import { itemsOf, useExportWaitlist, useWaitlist } from './use-admin-panel';

type ExportOutcome = 'done' | 'failed';

/**
 * «Lista de espera» de «Administración»: las inscripciones filtradas por municipio y paginadas, con
 * «Exportar CSV» (descarga en la web, hoja de compartir en el móvil) que respeta el filtro.
 */
export function WaitlistScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { dataExporter } = useServices();
  const [text, setText] = useState('');
  const [municipality, setMunicipality] = useState('');
  const [outcome, setOutcome] = useState<ExportOutcome | null>(null);
  const query = useWaitlist(municipality);
  const exportCsv = useExportWaitlist();
  const entries = itemsOf(query.data);

  const filename = t('admin.waitlist.filename');
  const download = async () => {
    setOutcome(null);
    try {
      const content = await exportCsv.mutateAsync(municipality);
      await dataExporter.deliver({ filename, content, mimeType: 'text/csv' });
      setOutcome('done');
    } catch {
      setOutcome('failed');
    }
  };

  return (
    <AdminScreen>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: theme.space[4], paddingVertical: theme.space[5] }}
      >
        <View style={{ gap: theme.space[1] }}>
          <Text variant="title" accessibilityRole="header">
            {t('admin.waitlist.title')}
          </Text>
          <Text tone="textMuted">{t('admin.waitlist.intro')}</Text>
        </View>
        <TextField
          label={t('admin.waitlist.municipalityLabel')}
          value={text}
          onChangeText={setText}
          autoCapitalize="words"
          returnKeyType="search"
          onSubmitEditing={() => {
            setMunicipality(text.trim());
          }}
        />
        <Button
          variant="secondary"
          label={t('admin.waitlist.filter')}
          onPress={() => {
            setMunicipality(text.trim());
          }}
        />
        <Button
          label={t('admin.waitlist.export')}
          loading={exportCsv.isPending}
          onPress={() => {
            download().catch(() => undefined);
          }}
        />
        {outcome === 'done' ? (
          <Notice tone="success">{t('admin.waitlist.exportDone', { filename })}</Notice>
        ) : null}
        {outcome === 'failed' ? (
          <Notice tone="danger">{t('admin.waitlist.exportFailed')}</Notice>
        ) : null}
        <PagedSection
          query={query}
          count={entries.length}
          empty={{
            title: t('admin.waitlist.empty.title'),
            description: t('admin.waitlist.empty.description'),
          }}
          texts={{
            loadFailed: t('admin.waitlist.loadFailed'),
            retry: t('admin.waitlist.retry'),
            loadMore: t('admin.waitlist.loadMore'),
            loadMoreFailed: t('admin.waitlist.loadMoreFailed'),
          }}
        >
          <DataTable<WaitlistEntry>
            items={entries}
            keyOf={(entry) => entry.email}
            columns={[
              { key: 'email', header: t('admin.waitlist.columns.email'), value: (e) => e.email },
              {
                key: 'municipality',
                header: t('admin.waitlist.columns.municipality'),
                value: (e) => e.municipality,
              },
              {
                key: 'homeType',
                header: t('admin.waitlist.columns.homeType'),
                value: (e) => t(`homes.type.${e.homeType}`),
              },
              {
                key: 'lookingFor',
                header: t('admin.waitlist.columns.lookingFor'),
                value: (e) => e.lookingFor,
              },
              {
                key: 'consentAt',
                header: t('admin.waitlist.columns.consentAt'),
                value: (e) => formatDate(e.consentAt),
              },
            ]}
          />
        </PagedSection>
      </ScrollView>
    </AdminScreen>
  );
}

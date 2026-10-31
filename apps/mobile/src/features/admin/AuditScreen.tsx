import { useTheme } from '@changehouse/ui';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { Text } from '../../ui';
import type { AuditEntry } from './admin-api';
import { AdminScreen } from './AdminScreen';
import { DataTable } from './DataTable';
import { formatDate } from './format-date';
import { PagedSection } from './PagedSection';
import { itemsOf, useAuditLog } from './use-admin-panel';

/** «Auditoría» de «Administración»: las acciones del equipo, de la más reciente a la más antigua, solo lectura. */
export function AuditScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const query = useAuditLog();
  const entries = itemsOf(query.data);

  return (
    <AdminScreen>
      <ScrollView contentContainerStyle={{ gap: theme.space[4], paddingVertical: theme.space[5] }}>
        <View style={{ gap: theme.space[1] }}>
          <Text variant="title" accessibilityRole="header">
            {t('admin.audit.title')}
          </Text>
          <Text tone="textMuted">{t('admin.audit.intro')}</Text>
        </View>
        <PagedSection
          query={query}
          count={entries.length}
          empty={{
            title: t('admin.audit.empty.title'),
            description: t('admin.audit.empty.description'),
          }}
          texts={{
            loadFailed: t('admin.audit.loadFailed'),
            retry: t('admin.audit.retry'),
            loadMore: t('admin.audit.loadMore'),
            loadMoreFailed: t('admin.audit.loadMoreFailed'),
          }}
        >
          <DataTable<AuditEntry>
            items={entries}
            keyOf={(entry) => String(entry.id)}
            columns={[
              { key: 'actor', header: t('admin.audit.columns.actor'), value: (e) => e.actorId },
              { key: 'action', header: t('admin.audit.columns.action'), value: (e) => e.action },
              { key: 'entity', header: t('admin.audit.columns.entity'), value: (e) => e.entity },
              { key: 'at', header: t('admin.audit.columns.at'), value: (e) => formatDate(e.at) },
            ]}
          />
        </PagedSection>
      </ScrollView>
    </AdminScreen>
  );
}

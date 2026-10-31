import { useTheme } from '@changehouse/ui';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, RefreshControl, View } from 'react-native';

import { Button, EmptyState, Notice, Text } from '../../ui';
import { LoadingView } from '../session/LoadingView';
import { AdminApiError, type Report } from './admin-api';
import { adminRoutes } from './admin-routes';
import { AdminScreen } from './AdminScreen';
import { ReportCard } from './ReportCard';
import { ResolveReportSheet } from './ResolveReportSheet';
import { reportsOf, useReportsQueue, useResolveReport } from './use-reports';

type Action = 'resolve' | 'dismiss';
type Outcome = 'resolved' | 'dismissed' | 'gone' | 'conflict';

interface Pending {
  report: Report;
  action: Action;
}

function failureKeyOf(error: unknown) {
  const kind = error instanceof AdminApiError ? error.kind : 'unknown';
  if (kind === 'network') return 'admin.failure.network';
  if (kind === 'invalid') return 'admin.reports.note.errors.invalid';
  return 'admin.failure.unknown';
}

/**
 * «Denuncias» dentro de «Administración»: las abiertas de la más antigua a la más reciente, que se
 * resuelven o desestiman con una nota obligatoria. La denuncia cerrada sale de la cola.
 */
export function ReportsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const queue = useReportsQueue();
  const resolve = useResolveReport();
  const [pending, setPending] = useState<Pending | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const decide = async (note: string) => {
    if (!pending) return;
    setFailure(null);
    try {
      await resolve.mutateAsync({
        reportId: pending.report.id,
        status: pending.action === 'resolve' ? 'resolved' : 'dismissed',
        resolution: note,
      });
      setOutcome(pending.action === 'resolve' ? 'resolved' : 'dismissed');
      setPending(null);
    } catch (error) {
      if (
        error instanceof AdminApiError &&
        (error.kind === 'not-found' || error.kind === 'conflict')
      ) {
        setOutcome(error.kind === 'conflict' ? 'conflict' : 'gone');
        setPending(null);
      } else {
        setFailure(t(failureKeyOf(error)));
      }
    }
  };

  const open = (report: Report, action: Action) => {
    setFailure(null);
    setPending({ report, action });
  };

  const header = (
    <View style={{ gap: theme.space[3] }}>
      <Button
        variant="ghost"
        label={t('admin.reports.back')}
        onPress={() => {
          router.dismissTo(adminRoutes.queue);
        }}
      />
      <Text variant="title" accessibilityRole="header">
        {t('admin.reports.title')}
      </Text>
      <Text tone="textMuted">{t('admin.reports.intro')}</Text>
      {outcome ? (
        <Notice tone={outcome === 'gone' || outcome === 'conflict' ? 'warning' : 'success'}>
          {t(`admin.reports.outcome.${outcome}`)}
        </Notice>
      ) : null}
    </View>
  );

  if (queue.isPending) return <LoadingView />;

  if (!queue.data) {
    return (
      <AdminScreen>
        <View style={{ gap: theme.space[4], paddingVertical: theme.space[5] }}>
          {header}
          <Notice
            tone="danger"
            action={{
              label: t('admin.reports.retry'),
              onPress: () => {
                queue.refetch().catch(() => undefined);
              },
            }}
          >
            {t('admin.reports.loadFailed')}
          </Notice>
        </View>
      </AdminScreen>
    );
  }

  return (
    <AdminScreen>
      <FlatList
        testID="reports-queue"
        data={reportsOf(queue.data)}
        keyExtractor={(report) => report.id}
        contentContainerStyle={{ gap: theme.space[4], paddingVertical: theme.space[5] }}
        refreshControl={
          <RefreshControl
            refreshing={queue.isRefetching && !queue.isFetchingNextPage}
            onRefresh={() => {
              queue.refetch().catch(() => undefined);
            }}
          />
        }
        ListHeaderComponent={header}
        ListEmptyComponent={
          <EmptyState
            icon="shield-checkmark-outline"
            title={t('admin.reports.empty.title')}
            description={t('admin.reports.empty.description')}
          />
        }
        renderItem={({ item }) => (
          <ReportCard
            report={item}
            busy={resolve.isPending}
            onResolve={() => {
              open(item, 'resolve');
            }}
            onDismiss={() => {
              open(item, 'dismiss');
            }}
          />
        )}
        ListFooterComponent={
          <View style={{ gap: theme.space[3] }}>
            {queue.isFetchNextPageError ? (
              <Notice tone="danger">{t('admin.reports.loadMoreFailed')}</Notice>
            ) : null}
            {queue.hasNextPage ? (
              <Button
                variant="secondary"
                label={t('admin.reports.loadMore')}
                loading={queue.isFetchingNextPage}
                onPress={() => {
                  queue.fetchNextPage().catch(() => undefined);
                }}
              />
            ) : null}
          </View>
        }
      />
      <ResolveReportSheet
        // La nota se reinicia al cambiar de denuncia o de decisión
        key={pending ? `${pending.report.id}-${pending.action}` : 'closed'}
        action={pending?.action ?? 'resolve'}
        visible={pending !== null}
        submitting={resolve.isPending}
        failure={failure}
        onSubmit={(note) => {
          decide(note).catch(() => undefined);
        }}
        onCancel={() => {
          setFailure(null);
          setPending(null);
        }}
      />
    </AdminScreen>
  );
}

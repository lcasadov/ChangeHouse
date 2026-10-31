import { useTheme } from '@changehouse/ui';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';

import { Button, EmptyState, Notice } from '../../ui';

export interface PagedQueryState {
  isPending: boolean;
  isError: boolean;
  isFetchNextPageError: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  refetch: () => Promise<unknown>;
  fetchNextPage: () => Promise<unknown>;
}

export interface PagedSectionProps {
  query: PagedQueryState;
  /** Cuántos elementos hay cargados. */
  count: number;
  empty: { title: string; description: string };
  texts: { loadFailed: string; retry: string; loadMore: string; loadMoreFailed: string };
  children: ReactNode;
}

/** Los estados de una lista paginada de «Administración»: cargando, error, vacía y con «Cargar más». */
export function PagedSection({
  query,
  count,
  empty,
  texts,
  children,
}: Readonly<PagedSectionProps>) {
  const { t } = useTranslation();
  const theme = useTheme();

  if (query.isPending) {
    return (
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
  }
  if (query.isError && count === 0) {
    return (
      <Notice
        tone="danger"
        action={{
          label: texts.retry,
          onPress: () => {
            query.refetch().catch(() => undefined);
          },
        }}
      >
        {texts.loadFailed}
      </Notice>
    );
  }
  if (count === 0) {
    return (
      <EmptyState icon="file-tray-outline" title={empty.title} description={empty.description} />
    );
  }
  return (
    <View style={{ gap: theme.space[4] }}>
      {children}
      {query.isFetchNextPageError ? <Notice tone="danger">{texts.loadMoreFailed}</Notice> : null}
      {query.hasNextPage ? (
        <Button
          variant="secondary"
          label={texts.loadMore}
          loading={query.isFetchingNextPage}
          onPress={() => {
            query.fetchNextPage().catch(() => undefined);
          }}
        />
      ) : null}
    </View>
  );
}

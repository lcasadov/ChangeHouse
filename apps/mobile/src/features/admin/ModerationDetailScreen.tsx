import { useTheme } from '@changehouse/ui';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Badge, Button, Dialog, FormScreen, Notice, Text } from '../../ui';
import { STATUS_PRESENTATION } from '../homes/home-status';
import { useHomeTitle } from '../homes/HomeCard';
import type { Home } from '../homes/homes-api';
import { HomeSummary } from '../homes/HomeSummary';
import { LoadingView } from '../session/LoadingView';
import { AdminApiError, type ModerationDecision } from './admin-api';
import { adminRoutes } from './admin-routes';
import { formatDate } from './format-date';
import { PhotoCarousel } from './PhotoCarousel';
import { RejectSheet } from './RejectSheet';
import { homesOf, useModerate, useModerationQueue } from './use-moderation';

type Outcome = 'approved' | 'rejected' | 'gone';

const OUTCOME_TONE = { approved: 'success', rejected: 'success', gone: 'warning' } as const;

/** Una decisión que ya no tiene sentido porque la vivienda dejó de estar en revisión. */
const isGone = (error: unknown) =>
  error instanceof AdminApiError && (error.kind === 'conflict' || error.kind === 'not-found');

type FailureKey = 'admin.failure.network' | 'admin.failure.unknown' | 'admin.reject.errors.invalid';

function failureKey(error: unknown, decision: ModerationDecision['decision']): FailureKey {
  const kind = error instanceof AdminApiError ? error.kind : 'unknown';
  if (kind === 'network') return 'admin.failure.network';
  if (kind === 'invalid' && decision === 'reject') return 'admin.reject.errors.invalid';
  return 'admin.failure.unknown';
}

function ModerationDetail({ home }: Readonly<{ home: Home }>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const title = useHomeTitle(home);
  const moderate = useModerate(home.id);
  const { tone, icon } = STATUS_PRESENTATION[home.status];
  const [confirmingApproval, setConfirmingApproval] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const backToQueue = () => {
    router.dismissTo(adminRoutes.queue);
  };

  const decide = async (decision: ModerationDecision) => {
    setFailure(null);
    try {
      await moderate.mutateAsync(decision);
      setOutcome(decision.decision === 'approve' ? 'approved' : 'rejected');
      setRejecting(false);
    } catch (error) {
      if (isGone(error)) {
        setOutcome('gone');
        setRejecting(false);
      } else {
        setFailure(t(failureKey(error, decision.decision)));
      }
    }
  };

  if (outcome) {
    return (
      <FormScreen>
        <Notice
          tone={OUTCOME_TONE[outcome]}
          action={{ label: t('admin.outcome.back'), onPress: backToQueue }}
        >
          {t(`admin.outcome.${outcome}`)}
        </Notice>
      </FormScreen>
    );
  }

  return (
    <FormScreen>
      <Button variant="ghost" label={t('admin.detail.back')} onPress={backToQueue} />
      <PhotoCarousel home={home} title={title} />
      <Text variant="title" accessibilityRole="header">
        {title}
      </Text>
      <Badge tone={tone} icon={icon} label={t(`homes.status.${home.status}`)} />
      {home.createdAt ? (
        <Text tone="textMuted">
          {t('admin.detail.created', { date: formatDate(home.createdAt) })}
        </Text>
      ) : null}
      <HomeSummary home={home} />
      {failure && !rejecting ? <Notice tone="danger">{failure}</Notice> : null}
      <View style={{ gap: theme.space[3] }}>
        <Button
          label={t('admin.approve.action')}
          loading={moderate.isPending}
          onPress={() => {
            setConfirmingApproval(true);
          }}
        />
        <Button
          variant="danger"
          label={t('admin.reject.action')}
          disabled={moderate.isPending}
          onPress={() => {
            setFailure(null);
            setRejecting(true);
          }}
        />
      </View>
      <Dialog
        visible={confirmingApproval}
        title={t('admin.approve.title')}
        description={t('admin.approve.description')}
        confirmLabel={t('admin.approve.confirm')}
        cancelLabel={t('admin.approve.cancel')}
        onConfirm={() => {
          setConfirmingApproval(false);
          decide({ decision: 'approve' }).catch(() => undefined);
        }}
        onCancel={() => {
          setConfirmingApproval(false);
        }}
      />
      <RejectSheet
        visible={rejecting}
        submitting={moderate.isPending}
        failure={failure}
        onSubmit={(reason) => {
          decide({ decision: 'reject', reason }).catch(() => undefined);
        }}
        onCancel={() => {
          setFailure(null);
          setRejecting(false);
        }}
      />
    </FormScreen>
  );
}

/**
 * Detalle de una vivienda de la cola: carrusel de fotos, ficha completa y las acciones «Aprobar» y
 * «Rechazar». El contrato no tiene una consulta de una vivienda para el admin, así que la ficha sale
 * de la cola; si se abre por su enlace, se recorren sus páginas hasta encontrarla.
 */
export function ModerationDetailScreen({ homeId }: Readonly<{ homeId: string }>) {
  const { t } = useTranslation();
  const router = useRouter();
  const queue = useModerationQueue();
  const current = homesOf(queue.data).find((home) => home.id === homeId);
  // La ficha se conserva aunque la cola se refresque sin ella (tras decidir, ya no está en revisión)
  const [found, setFound] = useState<Home | null>(null);
  if (current && current !== found) setFound(current);

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = queue;
  const searching = !found && (hasNextPage || isFetchingNextPage);
  useEffect(() => {
    if (!found && hasNextPage && !isFetchingNextPage) fetchNextPage().catch(() => undefined);
  }, [found, hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (found) return <ModerationDetail home={found} />;
  if (queue.isPending || searching) return <LoadingView />;

  const failed = !queue.data;
  return (
    <FormScreen>
      <Notice
        tone={failed ? 'danger' : 'warning'}
        action={
          failed
            ? {
                label: t('admin.queue.retry'),
                onPress: () => {
                  queue.refetch().catch(() => undefined);
                },
              }
            : {
                label: t('admin.detail.back'),
                onPress: () => {
                  router.dismissTo(adminRoutes.queue);
                },
              }
        }
      >
        {t(failed ? 'admin.queue.loadFailed' : 'admin.detail.gone')}
      </Notice>
    </FormScreen>
  );
}

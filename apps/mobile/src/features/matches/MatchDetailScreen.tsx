import { borderWidth, contentMaxWidth, touchTarget, useTheme } from '@changehouse/ui';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge, Button, Dialog, EmptyState, Link, Notice, Screen, Switch, Text } from '../../ui';
import { useFocusRing } from '../../ui/useFocusRing';
import { CompensationPill } from '../discovery/CompensationPill';
import { DetailGallery } from '../discovery/DetailGallery';
import { formatEuros } from '../homes/home-form';
import { homeTitleOf } from '../homes/home-title';
import { useMyHomes } from '../homes/use-homes';
import { LoadingView } from '../session/LoadingView';
import { detailViewOf, type MatchDetailView } from './match-detail-model';
import { compensationOf, kindOf } from './match-model';
import { matchRoutes } from './match-routes';
import { PARTICIPANT_PRESENTATION, STATUS_PRESENTATION } from './match-status';
import { type MatchDetail, MatchesApiError, type MatchParticipant } from './matches-api';
import { type ActionFailure, useMatchActions, useMatchDetail } from './use-match-detail';

/** Vuelve a donde se vino (la lista o «Explorar»); si se abrió por su dirección web, a «Matches». */
function useGoBack() {
  const router = useRouter();
  return () => {
    if (router.canGoBack()) router.back();
    else router.replace(matchRoutes.list);
  };
}

function BackButton({ onPress }: Readonly<{ onPress: () => void }>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const focusRing = useFocusRing();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('matches.detail.back')}
      onPress={onPress}
      onFocus={focusRing.onFocus}
      onBlur={focusRing.onBlur}
      style={[
        styles.back,
        { borderRadius: theme.radius.full, minHeight: touchTarget, minWidth: touchTarget },
        focusRing.style,
      ]}
    >
      <Ionicons
        accessible={false}
        name="arrow-back"
        size={theme.space[5]}
        color={theme.color.text}
      />
    </Pressable>
  );
}

const FAILURE_TONE: Record<ActionFailure, 'danger' | 'warning'> = {
  network: 'danger',
  server: 'danger',
  phone: 'danger',
  conflict: 'warning',
};

/** Lo que paga o recibe otro participante, en tercera persona; la propia compensación es la píldora. */
function OtherCompensation({ participant }: Readonly<{ participant: MatchParticipant }>) {
  const { t } = useTranslation();
  const name = participant.displayName;
  const { kind, amountCents } = compensationOf(participant.compensationCents);
  return (
    <Text variant="bodyStrong">
      {kind === 'fair'
        ? t('matches.detail.compensation.fair', { name })
        : t(`matches.detail.compensation.${kind}`, { name, amount: formatEuros(amountCents) })}
    </Text>
  );
}

/** Cómo localizar a otro participante: su teléfono si lo ha autorizado y, si no, que no lo ha hecho. */
function OtherPhone({ participant }: Readonly<{ participant: MatchParticipant }>) {
  const { t } = useTranslation();
  const name = participant.displayName;
  if (!participant.phone) {
    return <Text tone="textMuted">{t('matches.detail.phone.notShared', { name })}</Text>;
  }
  return (
    <Link
      label={t('matches.detail.phone.call', { name, phone: participant.phone })}
      href={`tel:${participant.phone}`}
    />
  );
}

interface ParticipantProps {
  participant: MatchParticipant;
  mine: boolean;
  view: MatchDetailView;
}

/** La vivienda que entrega un participante: fotos, dirección, compensación y, si lo autorizó, su teléfono. */
function ParticipantSection({ participant, mine, view }: Readonly<ParticipantProps>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const home = view.homeOf(participant.givesHomeId);
  const homeTitle = home ? homeTitleOf(t, home) : '';
  const presentation = PARTICIPANT_PRESENTATION[participant.status];
  const owner = mine ? 'mine' : 'theirs';
  const padding = { paddingHorizontal: theme.space[4] };

  return (
    <View
      testID="match-participant"
      style={{
        backgroundColor: theme.color.surface,
        borderBottomWidth: borderWidth.thin,
        borderColor: theme.color.border,
        borderTopWidth: borderWidth.thin,
        gap: theme.space[3],
        paddingVertical: theme.space[4],
      }}
    >
      <View style={[padding, { gap: theme.space[2] }]}>
        <Text variant="heading" accessibilityRole="header">
          {mine
            ? t('matches.detail.home.yours')
            : t('matches.detail.home.theirs', { name: participant.displayName })}
        </Text>
        <View style={styles.row}>
          <Badge
            tone={presentation.tone}
            icon={presentation.icon}
            label={t(`matches.detail.participantStatus.${owner}.${participant.status}`)}
          />
        </View>
      </View>
      {home ? <DetailGallery home={home} title={homeTitle} /> : null}
      <View style={[padding, { gap: theme.space[2] }]}>
        {home ? <Text variant="bodyStrong">{homeTitle}</Text> : null}
        {view.showContact && participant.exactAddress ? (
          <Text>{t('matches.detail.home.address', { address: participant.exactAddress })}</Text>
        ) : null}
        <View style={[styles.row, { gap: theme.space[2] }]}>
          {mine ? (
            <CompensationPill compensation={compensationOf(participant.compensationCents)} />
          ) : (
            <OtherCompensation participant={participant} />
          )}
          <Text variant="caption" tone="textMuted">
            {t('discovery.compensation.disclaimer')}
          </Text>
        </View>
        {!mine && view.showContact ? <OtherPhone participant={participant} /> : null}
      </View>
    </View>
  );
}

/** Compartir mi teléfono: un interruptor que se guarda al instante y avisa si no hay teléfono que compartir. */
function ContactSection({
  view,
  saving,
  onChange,
}: Readonly<{ view: MatchDetailView; saving: boolean; onChange: (share: boolean) => void }>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const sharing = view.mine?.sharesPhone === true;
  return (
    <View style={{ gap: theme.space[2] }}>
      <Text variant="heading" accessibilityRole="header">
        {t('matches.detail.contact.title')}
      </Text>
      <Switch
        label={t('matches.detail.contact.share')}
        description={t('matches.detail.contact.shareHint')}
        checked={sharing}
        disabled={saving}
        onChange={onChange}
      />
      {sharing && !view.mine?.phone ? (
        <Notice tone="info">{t('matches.detail.contact.missingPhone')}</Notice>
      ) : null}
    </View>
  );
}

interface DecisionProps {
  view: MatchDetailView;
  status: MatchDetail['status'];
  confirming: boolean;
  withdrawing: boolean;
  onConfirm: () => void;
  onWithdraw: () => void;
}

/** «Confirmar interés» (ya confirmado, deshabilitado y rotulado así) y «Retirarme». */
function DecisionSection({
  view,
  status,
  confirming,
  withdrawing,
  onConfirm,
  onWithdraw,
}: Readonly<DecisionProps>) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View style={{ gap: theme.space[3] }}>
      <Text variant="heading" accessibilityRole="header">
        {t('matches.detail.actions.title')}
      </Text>
      {view.canConfirm ? (
        <Button
          label={t('matches.detail.actions.confirm')}
          loading={confirming}
          onPress={onConfirm}
        />
      ) : null}
      {view.hasConfirmed ? (
        <View style={{ gap: theme.space[2] }}>
          <Button label={t('matches.detail.actions.confirmed')} disabled onPress={onConfirm} />
          {status === 'open' ? (
            <Text variant="caption" tone="textMuted">
              {t('matches.detail.actions.waiting')}
            </Text>
          ) : null}
        </View>
      ) : null}
      <Button
        variant="secondary"
        label={t('matches.detail.actions.withdraw')}
        loading={withdrawing}
        onPress={onWithdraw}
      />
    </View>
  );
}

/** El estado del match, quién lo ha confirmado y qué falta, con texto además de color e icono. */
function StatusHeader({ detail, view }: Readonly<{ detail: MatchDetail; view: MatchDetailView }>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const status = STATUS_PRESENTATION[detail.status];
  const names = (view.mine ? view.others : detail.participants)
    .map((participant) => participant.displayName)
    .join(', ');
  const closedBy = detail.status === 'closed' ? view.withdrawn : undefined;

  return (
    <View style={{ gap: theme.space[3] }}>
      <Text variant="title" accessibilityRole="header">
        {t('matches.detail.title', { names })}
      </Text>
      <View style={[styles.row, { gap: theme.space[2] }]}>
        <Badge tone={status.tone} icon={status.icon} label={t(`matches.status.${detail.status}`)} />
        <Text variant="caption" tone="textMuted">
          {t(`matches.kind.${kindOf(detail.type)}`)}
        </Text>
      </View>
      {view.showContact ? (
        <Text tone="textMuted">
          {t('matches.detail.progress', { confirmed: view.confirmedCount, total: view.total })}
        </Text>
      ) : null}
      <Text>{t(`matches.detail.hint.${detail.status}`)}</Text>
      {closedBy ? (
        <Notice tone="info">
          {closedBy === view.mine
            ? t('matches.detail.closedByYou')
            : t('matches.detail.closedBy', { name: closedBy.displayName })}
        </Notice>
      ) : null}
    </View>
  );
}

function Detail({ detail, view }: Readonly<{ detail: MatchDetail; view: MatchDetailView }>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const goBack = useGoBack();
  const query = useMatchDetail(detail.id);
  const actions = useMatchActions(detail.id, view.mine?.homeId);
  const [asking, setAsking] = useState(false);
  const [pulling, setPulling] = useState(false);
  const sections = view.mine ? [...view.others, view.mine] : detail.participants;

  const refresh = async () => {
    setPulling(true);
    try {
      await query.refetch();
    } finally {
      setPulling(false);
    }
  };

  return (
    <View testID="match-detail-root" style={[styles.root, { backgroundColor: theme.color.bg }]}>
      <ScrollView
        testID="match-detail-scroll"
        refreshControl={
          <RefreshControl
            refreshing={pulling}
            onRefresh={() => {
              refresh().catch(() => undefined);
            }}
          />
        }
        contentContainerStyle={{
          paddingBottom: insets.bottom + theme.space[6],
          paddingTop: insets.top + theme.space[2],
        }}
      >
        <View style={[styles.content, { gap: theme.space[4], maxWidth: contentMaxWidth.reading }]}>
          <View style={{ gap: theme.space[2], paddingHorizontal: theme.space[4] }}>
            <BackButton onPress={goBack} />
            <StatusHeader detail={detail} view={view} />
          </View>

          {sections.map((participant) => (
            <ParticipantSection
              key={participant.homeId}
              participant={participant}
              mine={participant === view.mine}
              view={view}
            />
          ))}

          <View style={{ gap: theme.space[4], paddingHorizontal: theme.space[4] }}>
            {actions.failure ? (
              <Notice tone={FAILURE_TONE[actions.failure]}>
                {t(`matches.detail.errors.${actions.failure}`)}
              </Notice>
            ) : null}
            {view.canSharePhone ? (
              <ContactSection
                view={view}
                saving={actions.savingPhone}
                onChange={actions.sharePhone}
              />
            ) : null}
            {view.canWithdraw ? (
              <DecisionSection
                view={view}
                status={detail.status}
                confirming={actions.confirming}
                withdrawing={actions.withdrawing}
                onConfirm={actions.confirm}
                onWithdraw={() => {
                  setAsking(true);
                }}
              />
            ) : null}
          </View>
        </View>
      </ScrollView>
      <Dialog
        visible={asking}
        title={t('matches.detail.withdrawDialog.title')}
        description={t('matches.detail.withdrawDialog.description')}
        confirmLabel={t('matches.detail.withdrawDialog.confirm')}
        cancelLabel={t('matches.detail.withdrawDialog.cancel')}
        onConfirm={() => {
          setAsking(false);
          actions.withdraw();
        }}
        onCancel={() => {
          setAsking(false);
        }}
      />
    </View>
  );
}

/**
 * El detalle de un match (`docs/style-guide.md` §3 y §5): su estado, las viviendas con todas sus
 * fotos y la dirección exacta de cada una, lo que paga o recibe cada participante, el teléfono de
 * quien lo ha autorizado y las decisiones de quien mira: compartir su teléfono, confirmar su interés
 * o retirarse. Retirarse cierra el match para todos, así que antes pide confirmación.
 */
export function MatchDetailScreen({ matchId }: Readonly<{ matchId: string }>) {
  const { t } = useTranslation();
  const goBack = useGoBack();
  const detail = useMatchDetail(matchId);
  const homes = useMyHomes();
  const ownHomeIds = useMemo(
    () => new Set((homes.data ?? []).map((home) => home.id)),
    [homes.data],
  );
  const view = useMemo(
    () => (detail.data ? detailViewOf(detail.data, ownHomeIds) : undefined),
    [detail.data, ownHomeIds],
  );

  const gone = detail.error instanceof MatchesApiError && detail.error.kind === 'not-found';
  if (gone) {
    return (
      <Screen>
        <EmptyState
          icon="heart-dislike-outline"
          title={t('matches.detail.gone.title')}
          description={t('matches.detail.gone.description')}
          action={{ label: t('matches.detail.gone.action'), onPress: goBack }}
        />
      </Screen>
    );
  }
  if (detail.data && view && homes.data) return <Detail detail={detail.data} view={view} />;
  if (detail.isError || homes.isError) {
    return (
      <Screen>
        <EmptyState
          icon="cloud-offline-outline"
          title={t('matches.detail.loadFailed.title')}
          description={t('matches.detail.loadFailed.description')}
          action={{
            label: t('matches.detail.loadFailed.retry'),
            onPress: () => {
              detail.refetch().catch(() => undefined);
              homes.refetch().catch(() => undefined);
            },
          }}
          secondaryAction={{ label: t('matches.detail.back'), onPress: goBack }}
        />
      </Screen>
    );
  }
  return <LoadingView />;
}

const styles = StyleSheet.create({
  back: { alignItems: 'center', alignSelf: 'flex-start', justifyContent: 'center' },
  content: { alignSelf: 'center', width: '100%' },
  root: { flex: 1 },
  row: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap' },
});

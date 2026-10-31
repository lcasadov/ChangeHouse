import { contentMaxWidth, useTheme } from '@changehouse/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton, EmptyState, Notice, Screen, Text } from '../../ui';
import { useMe } from '../account/use-me';
import { useAuth } from '../auth/AuthProvider';
import { useMyHomes } from '../homes/use-homes';
import { detailViewOf, type MatchDetailView } from '../matches/match-detail-model';
import { matchRoutes } from '../matches/match-routes';
import { type MatchDetail, MatchesApiError } from '../matches/matches-api';
import { useMatchDetail } from '../matches/use-match-detail';
import { MATCHES_QUERY_KEY } from '../matches/use-matches';
import { LoadingView } from '../session/LoadingView';
import { chatItemsOf, isChatWritable } from './chat-model';
import { Composer } from './Composer';
import { MessageList } from './MessageList';
import { useChatMessages } from './use-chat-messages';
import { useChatOutbox } from './use-chat-outbox';

/** Vuelve al detalle del match; si el chat se abrió por su dirección web, lo abre. */
function useBackToMatch(matchId: string) {
  const router = useRouter();
  return () => {
    if (router.canGoBack()) router.back();
    else router.replace(matchRoutes.detail(matchId));
  };
}

/** Por qué el chat es de solo lectura, con el nombre de quien se retiró si se sabe. */
function ReadOnlyNotice({
  detail,
  view,
}: Readonly<{ detail: MatchDetail; view: MatchDetailView }>) {
  const { t } = useTranslation();
  const { status } = detail;
  const withdrawn = view.withdrawn;
  if (status === 'closed' && withdrawn) {
    return (
      <Notice tone="info">
        {withdrawn === view.mine
          ? t('chat.readOnly.closedByYou')
          : t('chat.readOnly.closedBy', { name: withdrawn.displayName })}
      </Notice>
    );
  }
  const key = status === 'expired' || status === 'in_operation' ? status : 'closed';
  return <Notice tone="info">{t(`chat.readOnly.${key}`)}</Notice>;
}

interface ChatProps {
  detail: MatchDetail;
  view: MatchDetailView;
  onRefresh: () => void;
}

function Chat({ detail, view, onRefresh }: Readonly<ChatProps>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const goBack = useBackToMatch(detail.id);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const me = useMe();
  const channel = useChatMessages(detail.chatId, me.data?.id);
  const outbox = useChatOutbox({
    matchId: detail.id,
    // El match cambió por otro lado: se vuelve a pedir para enseñarlo como está ahora
    onClosed: () => {
      queryClient
        .invalidateQueries({ queryKey: [MATCHES_QUERY_KEY, user?.uid] })
        .catch(() => undefined);
    },
  });
  const items = useMemo(
    () => chatItemsOf(channel.messages, outbox.messages, me.data?.id),
    [channel.messages, outbox.messages, me.data?.id],
  );
  const names = view.others.map((participant) => participant.displayName).join(', ');
  const writable = isChatWritable(detail.status);

  const header = (
    <View style={{ gap: theme.space[2], padding: theme.space[4] }}>
      <BackButton label={t('chat.back')} onPress={goBack} />
      <Text variant="title" accessibilityRole="header">
        {t('chat.title', { names })}
      </Text>
    </View>
  );

  if (detail.chatId === undefined) {
    return (
      <Screen>
        <EmptyState
          icon="chatbubbles-outline"
          title={t('chat.preparing.title')}
          description={t('chat.preparing.description')}
          action={{ label: t('chat.preparing.retry'), onPress: onRefresh }}
          secondaryAction={{ label: t('chat.back'), onPress: goBack }}
        />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView
      testID="chat-root"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.root, { backgroundColor: theme.color.bg, paddingTop: insets.top }]}
    >
      <View style={[styles.column, { maxWidth: contentMaxWidth.reading }]}>
        {header}
        {channel.status === 'error' ? (
          <EmptyState
            icon="cloud-offline-outline"
            title={t('chat.loadFailed.title')}
            description={t('chat.loadFailed.description')}
            action={{ label: t('chat.loadFailed.retry'), onPress: channel.retry }}
          />
        ) : (
          <MessageList
            items={items}
            matchId={detail.id}
            loading={channel.status === 'loading'}
            onRetry={outbox.retry}
            onDiscard={outbox.discard}
          />
        )}
        {writable ? (
          <View style={{ paddingBottom: insets.bottom }}>
            <Composer
              attaching={outbox.picking}
              attachFailure={outbox.attachFailure}
              onAttach={() => {
                outbox.attachImage().catch(() => undefined);
              }}
              onSend={outbox.sendText}
            />
          </View>
        ) : (
          <View style={{ padding: theme.space[4], paddingBottom: insets.bottom + theme.space[4] }}>
            <ReadOnlyNotice detail={detail} view={view} />
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

/**
 * El chat de grupo de un match (`ChatThread` de `docs/style-guide.md` §3): los mensajes en tiempo
 * real, el envío de texto e imágenes y, cuando el match ya no está vivo, el historial en solo
 * lectura con el motivo. Sin chat creado todavía, explica que se está preparando.
 */
export function ChatScreen({ matchId }: Readonly<{ matchId: string }>) {
  const { t } = useTranslation();
  const router = useRouter();
  const goBack = useBackToMatch(matchId);
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

  if (detail.error instanceof MatchesApiError && detail.error.kind === 'not-found') {
    return (
      <Screen>
        <EmptyState
          icon="heart-dislike-outline"
          title={t('matches.detail.gone.title')}
          description={t('matches.detail.gone.description')}
          action={{
            label: t('matches.detail.gone.action'),
            onPress: () => router.replace(matchRoutes.list),
          }}
        />
      </Screen>
    );
  }
  if (detail.data && view && homes.data) {
    return (
      <Chat
        detail={detail.data}
        view={view}
        onRefresh={() => {
          detail.refetch().catch(() => undefined);
        }}
      />
    );
  }
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
          secondaryAction={{ label: t('chat.back'), onPress: goBack }}
        />
      </Screen>
    );
  }
  return <LoadingView />;
}

const styles = StyleSheet.create({
  column: { alignSelf: 'center', flex: 1, width: '100%' },
  root: { flex: 1 },
});

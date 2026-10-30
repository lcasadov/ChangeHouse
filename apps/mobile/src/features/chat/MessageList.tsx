import { useTheme } from '@changehouse/ui';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  View,
} from 'react-native';

import type { ChatItem } from './chat-model';
import { MessageBubble, SystemMessage } from './MessageBubble';

export interface MessageListProps {
  items: readonly ChatItem[];
  matchId: string;
  /** Aún no ha llegado el primer envío del canal. */
  loading: boolean;
  onRetry: (key: string) => void;
  onDiscard: (key: string) => void;
}

/**
 * Los mensajes en orden, siempre anclados al final: lo último que llega se ve sin desplazarse,
 * salvo que se esté leyendo más arriba. Un mensaje propio baja la lista aunque se estuviera arriba.
 */
export function MessageList({
  items,
  matchId,
  loading,
  onRetry,
  onDiscard,
}: Readonly<MessageListProps>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const scroller = useRef<ScrollViewInstance>(null);
  const atBottom = useRef(true);
  const lastIsMine = (() => {
    const last = items.at(-1);
    return last?.type === 'message' && last.mine;
  })();

  const follow = () => {
    if (atBottom.current || lastIsMine) scroller.current?.scrollToEnd({ animated: false });
  };
  const track = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
    atBottom.current =
      contentOffset.y + layoutMeasurement.height >= contentSize.height - theme.space[6];
  };

  return (
    <ScrollView
      ref={scroller}
      style={styles.list}
      onContentSizeChange={follow}
      onScroll={track}
      scrollEventThrottle={100}
      contentContainerStyle={{ gap: theme.space[3], padding: theme.space[4] }}
    >
      {loading ? (
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={t('chat.loading')}
          accessibilityLiveRegion="polite"
          style={styles.loading}
        >
          <ActivityIndicator size="large" color={theme.color.primary} />
        </View>
      ) : (
        items.map((item) =>
          item.type === 'system' ? (
            <SystemMessage key={item.key} item={item} />
          ) : (
            <MessageBubble
              key={item.key}
              item={item}
              matchId={matchId}
              onRetry={onRetry}
              onDiscard={onDiscard}
            />
          ),
        )
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  loading: { alignItems: 'center' },
});

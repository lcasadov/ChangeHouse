import { CHAT_MESSAGE_MAX_LENGTH } from '@changehouse/shared';
import { contentMaxWidth, useTheme } from '@changehouse/ui';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Button, Text } from '../../ui';
import { formatLocalTime } from '../discovery/decision-time';
import { MoreOptions } from '../moderation/MoreOptions';
import { canRetry, formatCount, type MessageItem, type SystemItem } from './chat-model';
import { useChatImage } from './use-chat-image';

/** Una imagen no ocupa más de esta parte del ancho de la pantalla. */
const IMAGE_WIDTH_RATIO = 0.6;
const IMAGE_ASPECT_RATIO = 4 / 3;
/** Una burbuja de texto deja siempre sitio libre en el lado contrario. */
const BUBBLE_MAX_WIDTH = '85%';

/** Texto que ya forma parte de la etiqueta del mensaje: no se lee dos veces. */
const decorative = { accessible: false, importantForAccessibility: 'no' } as const;

interface MessageProps {
  item: MessageItem;
  matchId: string;
  onRetry: (key: string) => void;
  onDiscard: (key: string) => void;
}

function useImageSize() {
  const { width } = useWindowDimensions();
  return Math.min(width * IMAGE_WIDTH_RATIO, contentMaxWidth.card);
}

/** La imagen de un mensaje: la foto local mientras se envía y, si no, la que da la URL firmada. */
function ChatImage({
  item,
  matchId,
  label,
}: Readonly<{ item: MessageItem; matchId: string; label: string }>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const width = useImageSize();
  const query = useChatImage(matchId, item.imageId);
  const box = {
    aspectRatio: IMAGE_ASPECT_RATIO,
    backgroundColor: theme.color.surfaceMuted,
    borderRadius: theme.radius.lg,
    width,
  };
  const uri = item.localUri ?? query.data?.url;

  if (uri) {
    return (
      <Image
        source={{ uri }}
        contentFit="cover"
        cachePolicy="memory-disk"
        accessible
        accessibilityRole="image"
        accessibilityLabel={label}
        style={box}
      />
    );
  }
  if (query.isError) {
    return (
      <View style={[box, styles.centered, { gap: theme.space[2], padding: theme.space[3] }]}>
        <Text tone="textMuted" style={styles.centerText}>
          {t('chat.message.imageFailed')}
        </Text>
        <Button
          variant="secondary"
          label={t('chat.message.imageRetry')}
          onPress={() => {
            query.refetch().catch(() => undefined);
          }}
        />
      </View>
    );
  }
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('chat.message.imageLoading')}
      style={[box, styles.centered]}
    >
      <ActivityIndicator color={theme.color.primary} />
    </View>
  );
}

/** Lo que dice del envío un mensaje propio que aún no ha llegado o ha fallado, con sus acciones. */
function DeliveryStatus({
  item,
  onRetry,
  onDiscard,
}: Readonly<Pick<MessageProps, 'item' | 'onRetry' | 'onDiscard'>>) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  if (item.state === 'sent') return null;
  if (item.state === 'sending') {
    return (
      <Text variant="caption" tone="textMuted">
        {t('chat.status.sending')}
      </Text>
    );
  }
  const failure = item.failure ?? 'server';
  const reason = t(`chat.failure.${failure}`, {
    max: formatCount(CHAT_MESSAGE_MAX_LENGTH, i18n.language),
  });
  const key = item.outgoingKey ?? '';
  return (
    <View style={{ gap: theme.space[1] }}>
      <View
        accessible
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={[styles.row, { gap: theme.space[1] }]}
      >
        <Ionicons
          name="alert-circle"
          size={theme.font.caption.lineHeight}
          color={theme.color.danger}
        />
        <Text variant="caption" tone="danger" style={styles.shrink}>
          {t('chat.status.failed', { reason })}
        </Text>
      </View>
      <View style={[styles.row, { gap: theme.space[2] }]}>
        {canRetry(item.failure) ? (
          <Button
            variant="ghost"
            label={t('chat.status.retry')}
            onPress={() => {
              onRetry(key);
            }}
          />
        ) : null}
        <Button
          variant="ghost"
          label={t('chat.status.discard')}
          onPress={() => {
            onDiscard(key);
          }}
        />
      </View>
    </View>
  );
}

/** «Más opciones» de un mensaje ajeno ya entregado: denunciarlo y, si consta quién es, bloquearle. */
function MessageOptions({ item, time }: Readonly<{ item: MessageItem; time: string }>) {
  const { t } = useTranslation();
  if (item.mine || item.state !== 'sent') return null;
  return (
    <MoreOptions
      subject={t('moderation.more.subject.message', { name: item.senderName, time })}
      report={{ type: 'message', id: item.key }}
      {...(item.senderId ? { block: { userId: item.senderId, name: item.senderName } } : {})}
    />
  );
}

/**
 * Un mensaje del chat (`MessageBubble` de `docs/style-guide.md` §3): los propios a la derecha con
 * el color de acción, los ajenos a la izquierda con el nombre de quien escribe, y en ambos la hora.
 * Todo el mensaje se anuncia como una sola frase («Beto, 10:05: …»); los controles de reintento
 * quedan fuera de ella para seguir siendo alcanzables.
 */
export function MessageBubble({ item, matchId, onRetry, onDiscard }: Readonly<MessageProps>) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const time = formatLocalTime(item.createdAt, i18n.language);
  const side = item.mine ? 'own' : 'other';
  const isImage = item.kind === 'image';
  const label = isImage
    ? t(item.mine ? 'chat.message.imageFromMe' : 'chat.message.imageFrom', {
        name: item.senderName,
        time,
      })
    : t(item.mine ? 'chat.message.fromMe' : 'chat.message.from', {
        name: item.senderName,
        time,
        text: item.text ?? '',
      });

  return (
    <View
      testID={`chat-row-${side}`}
      style={[
        styles.fullWidth,
        { alignItems: item.mine ? 'flex-end' : 'flex-start', gap: theme.space[1] },
      ]}
    >
      <View style={{ alignItems: item.mine ? 'flex-end' : 'flex-start', gap: theme.space[1] }}>
        {item.mine ? null : (
          <Text variant="label" tone="textMuted" {...decorative}>
            {item.senderName}
          </Text>
        )}
        {isImage ? (
          <ChatImage item={item} matchId={matchId} label={label} />
        ) : (
          <View
            testID={`chat-bubble-${side}`}
            accessible
            accessibilityLabel={label}
            style={{
              backgroundColor: item.mine ? theme.color.primary : theme.color.surfaceMuted,
              borderRadius: theme.radius.lg,
              maxWidth: BUBBLE_MAX_WIDTH,
              paddingHorizontal: theme.space[4],
              paddingVertical: theme.space[3],
            }}
          >
            <Text tone={item.mine ? 'textOnPrimary' : 'text'} {...decorative}>
              {item.text}
            </Text>
          </View>
        )}
        <Text variant="caption" tone="textMuted" {...decorative}>
          {time}
        </Text>
      </View>
      <DeliveryStatus item={item} onRetry={onRetry} onDiscard={onDiscard} />
      <MessageOptions item={item} time={time} />
    </View>
  );
}

/** El aviso del sistema (la bienvenida): centrado, sobre una superficie, sin remitente. */
export function SystemMessage({ item }: Readonly<{ item: SystemItem }>) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View
      style={[
        styles.fullWidth,
        styles.centered,
        {
          backgroundColor: theme.color.surfaceMuted,
          borderRadius: theme.radius.lg,
          padding: theme.space[3],
        },
      ]}
    >
      <Text tone="textMuted" style={styles.centerText}>
        {t('chat.welcome', { names: item.participantNames.join(', ') })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { alignItems: 'center', justifyContent: 'center' },
  centerText: { textAlign: 'center' },
  fullWidth: { width: '100%' },
  row: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap' },
  shrink: { flexShrink: 1 },
});

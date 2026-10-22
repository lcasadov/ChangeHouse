import { borderWidth, touchTarget, useTheme } from '@changehouse/ui';
import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { Badge, Button, Text } from '../../ui';
import { useFocusRing } from '../../ui/useFocusRing';
import { canRetry, type UploadItem } from './home-photos';
import type { HomePhoto } from './homes-api';

const PERCENT = 100;

interface FrameProps {
  position: number;
  uri: string;
  /** Texto alternativo si la imagen informa; vacío si el nombre accesible lo da el contenedor. */
  label?: string;
  children: ReactNode;
}

/** Marco común de una foto: imagen a sangre arriba y, debajo, su estado y sus acciones. */
function Frame({ position, uri, label, children }: Readonly<FrameProps>) {
  const theme = useTheme();
  return (
    <View
      testID={`photo-tile-${String(position)}`}
      style={[
        styles.tile,
        {
          backgroundColor: theme.color.surface,
          borderColor: theme.color.border,
          borderRadius: theme.radius.md,
          borderWidth: borderWidth.thin,
          flexBasis: touchTarget * 3,
        },
      ]}
    >
      <Image
        source={{ uri }}
        resizeMode="cover"
        accessible={label !== undefined}
        accessibilityRole={label === undefined ? undefined : 'image'}
        accessibilityLabel={label}
        style={[styles.image, { backgroundColor: theme.color.surfaceMuted }]}
      />
      <View style={{ gap: theme.space[2], padding: theme.space[2] }}>{children}</View>
    </View>
  );
}

export interface ReadyPhotoTileProps {
  photo: HomePhoto;
  position: number;
  total: number;
  onRemove: () => void;
}

/** Una foto ya procesada y visible; la primera es la portada. */
export function ReadyPhotoTile({
  photo,
  position,
  total,
  onRemove,
}: Readonly<ReadyPhotoTileProps>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const focusRing = useFocusRing();
  const isCover = position === 1;

  return (
    <Frame
      position={position}
      uri={photo.url}
      label={
        isCover
          ? t('homes.photos.coverTile', { total })
          : t('homes.photos.tile', { position, total })
      }
    >
      <View style={[styles.row, { gap: theme.space[2] }]}>
        <View style={styles.grow}>
          {isCover ? <Badge tone="info" icon="star" label={t('homes.photos.cover')} /> : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('homes.photos.remove', { position })}
          onPress={onRemove}
          onFocus={focusRing.onFocus}
          onBlur={focusRing.onBlur}
          style={[
            styles.iconButton,
            { borderRadius: theme.radius.md, minHeight: touchTarget, minWidth: touchTarget },
            focusRing.style,
          ]}
        >
          <Ionicons
            accessible={false}
            name="trash-outline"
            size={theme.space[5]}
            color={theme.color.danger}
          />
        </Pressable>
      </View>
    </Frame>
  );
}

export interface PendingPhotoTileProps {
  item: UploadItem;
  position: number;
  total: number;
  /** Aún no hay borrador: la foto espera en el dispositivo. */
  waitingForHome: boolean;
  onRetry: () => void;
  onDiscard: () => void;
}

function useStatusText(item: UploadItem, waitingForHome: boolean): string {
  const { t } = useTranslation();
  if (item.stage === 'processing') return t('homes.photos.status.processing');
  if (item.stage === 'uploading') {
    return t('homes.photos.status.uploading', { percent: Math.round(item.progress * PERCENT) });
  }
  return waitingForHome ? t('homes.photos.status.queued') : t('homes.photos.status.waiting');
}

/** Una foto que se está subiendo o que falló: progreso anunciado o motivo con «Reintentar» y «Quitar». */
export function PendingPhotoTile({
  item,
  position,
  total,
  waitingForHome,
  onRetry,
  onDiscard,
}: Readonly<PendingPhotoTileProps>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const status = useStatusText(item, waitingForHome);
  const failed = item.stage === 'failed';
  const sending = item.stage === 'uploading' || item.stage === 'processing';

  return (
    <Frame position={position} uri={item.uri}>
      {failed ? (
        <View style={{ gap: theme.space[2] }}>
          <View
            accessible
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={[styles.row, { gap: theme.space[2] }]}
          >
            <Ionicons
              accessible={false}
              name="alert-circle"
              size={theme.space[5]}
              color={theme.color.danger}
            />
            <Text variant="caption" style={styles.grow}>
              {t(`homes.photos.failures.${item.failure ?? 'unknown'}`)}
            </Text>
          </View>
          {canRetry(item.failure) ? (
            <Button
              variant="secondary"
              label={t('homes.photos.retry')}
              accessibilityLabel={t('homes.photos.retryLabel', { position })}
              onPress={onRetry}
            />
          ) : null}
          <Button
            variant="ghost"
            label={t('homes.photos.discard')}
            accessibilityLabel={t('homes.photos.discardLabel', { position })}
            onPress={onDiscard}
          />
        </View>
      ) : (
        <View
          accessible
          accessibilityRole={sending ? 'progressbar' : undefined}
          accessibilityLabel={t('homes.photos.uploadingTile', { position, total, status })}
          accessibilityValue={
            sending ? { min: 0, max: PERCENT, now: Math.round(item.progress * PERCENT) } : undefined
          }
          style={{ gap: theme.space[2] }}
        >
          {sending ? (
            <View
              style={{
                backgroundColor: theme.color.surfaceMuted,
                borderRadius: theme.radius.full,
                height: theme.space[2],
              }}
            >
              <View
                style={{
                  backgroundColor: theme.color.primary,
                  borderRadius: theme.radius.full,
                  height: theme.space[2],
                  width: `${String(Math.round(item.progress * PERCENT))}%`,
                }}
              />
            </View>
          ) : null}
          <Text variant="caption" tone="textMuted">
            {status}
          </Text>
        </View>
      )}
    </Frame>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  iconButton: { alignItems: 'center', justifyContent: 'center' },
  image: { aspectRatio: 4 / 3, width: '100%' },
  row: { alignItems: 'center', flexDirection: 'row' },
  tile: { flexGrow: 1, overflow: 'hidden' },
});

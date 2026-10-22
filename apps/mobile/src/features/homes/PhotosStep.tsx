import { useTheme } from '@changehouse/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, Dialog, Notice, Text } from '../../ui';
import { MAX_PHOTOS, MIN_PHOTOS } from './home-form';
import { photosOf } from './home-photos';
import { type Home, type HomePhoto, HomesApiError } from './homes-api';
import { PendingPhotoTile, ReadyPhotoTile } from './PhotoTile';
import { useDeletePhoto } from './use-homes';
import type { PhotoUploads } from './use-photo-uploads';

export interface PhotosStepProps {
  /** La vivienda guardada; ausente en el alta, antes de crear el borrador. */
  home?: Home | undefined;
  uploads: PhotoUploads;
  /** Asistente: continúa al siguiente paso (las fotos se guardan al subirse, no hace falta guardar). */
  onNext?: (() => void) | undefined;
  /** Asistente: salir al listado. */
  onExit?: (() => void) | undefined;
  /** Gestión de las fotos de una vivienda ya enviada: vuelve al detalle. */
  onDone?: (() => void) | undefined;
}

type DeleteFailure = 'minimum' | 'failed' | null;

/** Paso 1 del asistente, fotos: elegir varias, ver el progreso de cada una, reintentar y quitar. */
export function PhotosStep({ home, uploads, onNext, onExit, onDone }: Readonly<PhotosStepProps>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const remove = useDeletePhoto(home?.id ?? '');
  const [toDelete, setToDelete] = useState<HomePhoto | null>(null);
  const [deleteFailure, setDeleteFailure] = useState<DeleteFailure>(null);

  const ready = photosOf(home);
  const total = ready.length + uploads.items.length;
  const full = total >= MAX_PHOTOS;

  const confirmDelete = async () => {
    if (!toDelete || remove.isPending) return;
    setDeleteFailure(null);
    try {
      await remove.mutateAsync(toDelete.id);
    } catch (error) {
      setDeleteFailure(
        error instanceof HomesApiError && error.kind === 'min-photos' ? 'minimum' : 'failed',
      );
    }
    setToDelete(null);
  };

  return (
    <View style={{ gap: theme.space[4] }}>
      <Text tone="textMuted">{t('homes.photos.intro')}</Text>
      <Text variant="label" tone="textMuted" accessibilityLiveRegion="polite">
        {t('homes.photos.counter', { count: total })}
      </Text>
      {total < MIN_PHOTOS ? <Text tone="textMuted">{t('homes.photos.minHint')}</Text> : null}
      {full ? <Text tone="textMuted">{t('homes.photos.limitReached')}</Text> : null}
      {uploads.pickFailed ? <Notice tone="danger">{t('homes.photos.pickFailed')}</Notice> : null}
      {deleteFailure ? (
        <Notice tone={deleteFailure === 'minimum' ? 'warning' : 'danger'}>
          {t(
            deleteFailure === 'minimum'
              ? 'homes.photos.delete.minimum'
              : 'homes.photos.delete.failed',
          )}
        </Notice>
      ) : null}
      <Button
        label={t('homes.photos.add')}
        disabled={full}
        loading={uploads.picking}
        onPress={() => {
          uploads.choose(MAX_PHOTOS - total, home?.id).catch(() => undefined);
        }}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[3] }}>
        {ready.map((photo, index) => (
          <ReadyPhotoTile
            key={photo.id}
            photo={photo}
            position={index + 1}
            total={total}
            onRemove={() => {
              setDeleteFailure(null);
              setToDelete(photo);
            }}
          />
        ))}
        {uploads.items.map((item, index) => (
          <PendingPhotoTile
            key={item.key}
            item={item}
            position={ready.length + index + 1}
            total={total}
            waitingForHome={home === undefined}
            onRetry={() => {
              uploads.retry(item.key, home?.id);
            }}
            onDiscard={() => {
              uploads.discard(item.key);
            }}
          />
        ))}
      </View>
      <View style={{ gap: theme.space[3] }}>
        {onNext ? <Button label={t('homes.wizard.next')} onPress={onNext} /> : null}
        {onDone ? <Button label={t('homes.photos.done')} onPress={onDone} /> : null}
        {onExit ? <Button variant="ghost" label={t('homes.wizard.exit')} onPress={onExit} /> : null}
      </View>
      <Dialog
        visible={toDelete !== null}
        title={t('homes.photos.delete.title')}
        description={t('homes.photos.delete.description')}
        confirmLabel={t('homes.photos.delete.confirm')}
        cancelLabel={t('homes.photos.delete.cancel')}
        onConfirm={() => {
          confirmDelete().catch(() => undefined);
        }}
        onCancel={() => {
          setToDelete(null);
        }}
      />
    </View>
  );
}

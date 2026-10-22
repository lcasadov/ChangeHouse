import { useTheme } from '@changehouse/ui';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Notice } from '../../ui';
import type { UploadItem } from './home-photos';

export interface UploadsBannerProps {
  items: readonly UploadItem[];
  /** Lleva al paso de fotos, donde se reintenta o se quita cada foto. */
  onShowPhotos: () => void;
}

/**
 * Estado de las fotos desde los demás pasos: se anuncia que se están subiendo y, si alguna falla,
 * se avisa con el camino para arreglarlo. No aparece cuando todo va bien.
 */
export function UploadsBanner({ items, onShowPhotos }: Readonly<UploadsBannerProps>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const uploading = items.filter((item) => item.stage !== 'failed').length;
  const failed = items.length - uploading;
  if (items.length === 0) return null;

  return (
    <View style={{ gap: theme.space[3] }}>
      {uploading > 0 ? (
        <Notice tone="info">{t('homes.photos.banner.uploading', { count: uploading })}</Notice>
      ) : null}
      {failed > 0 ? (
        <Notice
          tone="warning"
          action={{ label: t('homes.photos.banner.show'), onPress: onShowPhotos }}
        >
          {t('homes.photos.banner.failed', { count: failed })}
        </Notice>
      ) : null}
    </View>
  );
}

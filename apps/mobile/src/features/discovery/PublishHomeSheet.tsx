import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { BottomSheet, Button, Text } from '../../ui';
import { homeRoutes } from '../homes/home-routes';

export interface PublishHomeSheetProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * La invitación a quien intenta dar «me gusta» sin vivienda publicada (RN-01): explica por qué no
 * puede y lleva a «Mis casas», donde se publica. No llama a la API.
 */
export function PublishHomeSheet({ visible, onClose }: Readonly<PublishHomeSheetProps>) {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <BottomSheet
      visible={visible}
      title={t('discovery.publishSheet.title')}
      closeLabel={t('discovery.publishSheet.close')}
      onClose={onClose}
    >
      <Text>{t('discovery.publishSheet.message')}</Text>
      <Button
        label={t('discovery.publishSheet.action')}
        onPress={() => {
          onClose();
          router.push(homeRoutes.list);
        }}
      />
    </BottomSheet>
  );
}

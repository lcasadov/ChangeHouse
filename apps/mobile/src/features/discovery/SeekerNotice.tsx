import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Notice } from '../../ui';
import { homeRoutes } from '../homes/home-routes';

/** Aviso fijo de quien mira sin vivienda publicada: sin ella no hay match, y «Mis casas» es donde se publica. */
export function SeekerNotice() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Notice
      tone="info"
      action={{
        label: t('discovery.seekerNotice.action'),
        onPress: () => {
          router.push(homeRoutes.list);
        },
      }}
    >
      {t('discovery.seekerNotice.message')}
    </Notice>
  );
}

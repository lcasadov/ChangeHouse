import { useTranslation } from 'react-i18next';

import { Dialog } from '../../ui/Dialog';

export interface NotificationPermissionDialogProps {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

/** La explicación propia de para qué sirven los avisos, antes de la petición del sistema. */
export function NotificationPermissionDialog({
  visible,
  onAccept,
  onDecline,
}: Readonly<NotificationPermissionDialogProps>) {
  const { t } = useTranslation();
  return (
    <Dialog
      visible={visible}
      title={t('notifications.permission.title')}
      description={t('notifications.permission.description')}
      confirmLabel={t('notifications.permission.confirm')}
      cancelLabel={t('notifications.permission.cancel')}
      onConfirm={onAccept}
      onCancel={onDecline}
    />
  );
}

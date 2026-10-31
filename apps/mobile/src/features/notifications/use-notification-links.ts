import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { useServices } from '../session/services';
import { notificationTarget } from './notification-target';

/** Tocar un aviso abre el match o su chat. Solo se escucha con la sesión lista: antes no hay a dónde ir. */
export function useNotificationLinks(enabled: boolean): void {
  const { pushNotifications } = useServices();
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return undefined;
    return pushNotifications.onOpen((payload) => {
      const target = notificationTarget(payload);
      if (target) router.push(target);
    });
  }, [enabled, pushNotifications, router]);
}

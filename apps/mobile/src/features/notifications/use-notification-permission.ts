import { useRef, useState } from 'react';

import { useServices } from '../session/services';

/**
 * El permiso de avisos, pedido en contexto: tras el primer «Me gusta» con éxito y precedido de una
 * explicación propia, nunca al abrir la app. Se pregunta como mucho una vez por sesión; con el
 * permiso denegado no se vuelve a pedir, y con el permiso ya concedido solo se refresca el registro
 * del dispositivo.
 */
export function useNotificationPermission() {
  const { pushNotifications, accountApi } = useServices();
  const [explaining, setExplaining] = useState(false);
  const handled = useRef(false);

  /** El registro es secundario: si falla, la persona no tiene nada que hacer y se reintenta otro día. */
  const register = async () => {
    try {
      const fcmToken = await pushNotifications.getDeviceToken();
      if (fcmToken)
        await accountApi.registerDevice({ fcmToken, platform: pushNotifications.platform });
    } catch {
      // Sin token o sin red: los avisos se activarán la próxima vez que se registre
    }
  };

  /** Llamar tras un «Me gusta» registrado por la API. */
  const afterLike = async () => {
    if (!pushNotifications.supported || handled.current) return;
    handled.current = true;
    try {
      const permission = await pushNotifications.getPermission();
      if (permission === 'granted') await register();
      else if (permission === 'undetermined') setExplaining(true);
    } catch {
      // Sin acceso al estado del permiso no hay nada que ofrecer
    }
  };

  const accept = async () => {
    setExplaining(false);
    try {
      if ((await pushNotifications.requestPermission()) === 'granted') await register();
    } catch {
      // El sistema no ha podido preguntar: no se insiste
    }
  };

  const decline = () => {
    setExplaining(false);
  };

  return { explaining, afterLike, accept, decline };
}

import type { PushNotification } from './notifier.js';

/*
 * Textos de los avisos push. Solo el tipo de evento y, en los mensajes, el nombre visible del
 * remitente: nunca direcciones, teléfonos, importes ni el contenido del mensaje.
 */

export function matchCreatedPush(matchId: string): PushNotification {
  return {
    title: '¡Tienes un match!',
    body: 'Entra en ChangeHouse para verlo.',
    data: { type: 'match.created', matchId },
  };
}

export function matchConfirmedPush(matchId: string): PushNotification {
  return {
    title: '¡Match confirmado!',
    body: 'Todos los participantes han confirmado su interés.',
    data: { type: 'match.confirmed', matchId },
  };
}

export function matchClosedPush(matchId: string): PushNotification {
  return {
    title: 'Tu match se ha cerrado',
    body: 'Ya no se pueden enviar más mensajes.',
    data: { type: 'match.closed', matchId },
  };
}

export function messageSentPush(matchId: string, senderName: string): PushNotification {
  return {
    title: `Nuevo mensaje de ${senderName}`,
    body: 'Abre el chat para leerlo.',
    data: { type: 'message.sent', matchId },
  };
}

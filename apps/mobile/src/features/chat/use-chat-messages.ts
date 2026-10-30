import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { announce } from '../../ui/announce';
import { useServices } from '../session/services';
import type { ChatMessage } from './chat-messages';

export type ChatChannelStatus = 'idle' | 'loading' | 'ready' | 'error';

interface Snapshot {
  chatId: string;
  /** El intento de conexión al que responde: así un reintento vuelve a «cargando». */
  attempt: number;
  status: 'ready' | 'error';
  messages: ChatMessage[];
}

export interface ChatChannel {
  status: ChatChannelStatus;
  messages: ChatMessage[];
  /** Vuelve a escuchar tras un error del canal. */
  retry: () => void;
}

const NO_MESSAGES: ChatMessage[] = [];

/**
 * Los mensajes del chat en tiempo real mientras la pantalla está abierta. Los mensajes nuevos de
 * otras personas, una vez entregado el historial, se anuncian a los lectores de pantalla.
 */
export function useChatMessages(chatId: string | undefined, meId: string | undefined): ChatChannel {
  const { chatMessages } = useServices();
  const { t } = useTranslation();
  const [attempt, setAttempt] = useState(0);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const known = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (chatId === undefined) return undefined;
    known.current = null;
    return chatMessages.subscribe(chatId, {
      onMessages: (messages) => {
        setSnapshot({ chatId, attempt, status: 'ready', messages });
      },
      onError: () => {
        setSnapshot({ chatId, attempt, status: 'error', messages: NO_MESSAGES });
      },
    });
  }, [chatId, attempt, chatMessages]);

  const current =
    snapshot !== null && snapshot.chatId === chatId && snapshot.attempt === attempt
      ? snapshot
      : null;
  const messages = current?.status === 'ready' ? current.messages : NO_MESSAGES;
  const ready = current?.status === 'ready';

  useEffect(() => {
    if (!ready) return;
    const before = known.current;
    known.current = new Set(messages.map((message) => message.id));
    // La primera entrega es el historial: solo lo que llega después se anuncia
    if (before === null) return;
    for (const message of messages) {
      if (before.has(message.id) || message.kind === 'system' || message.senderId === meId)
        continue;
      announce(
        message.kind === 'text'
          ? t('chat.announce.received', { name: message.senderName, text: message.text })
          : t('chat.announce.receivedImage', { name: message.senderName }),
      );
    }
  }, [ready, messages, meId, t]);

  let status: ChatChannelStatus = 'loading';
  if (chatId === undefined) status = 'idle';
  else if (current) status = current.status;

  return { status, messages, retry: () => setAttempt((value) => value + 1) };
}

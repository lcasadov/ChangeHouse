import { CHAT_MESSAGE_MAX_LENGTH } from '@changehouse/shared';

import { at, imageFrom, textFrom, welcome } from '../../test-support/fake-chat';
import { ChatApiError } from './chat-api';
import {
  canRetry,
  chatItemsOf,
  draftStateOf,
  failureOf,
  formatCount,
  imageUrlFreshForMs,
  isChatWritable,
  type OutgoingMessage,
} from './chat-model';

const ME = 'me';

const outgoing = (overrides: Partial<OutgoingMessage> = {}): OutgoingMessage => ({
  key: 'local-1',
  kind: 'text',
  text: 'Hola',
  stage: 'sending',
  createdAt: at(40),
  ...overrides,
});

describe('isChatWritable', () => {
  it('solo se escribe mientras el match está abierto o confirmado', () => {
    expect(isChatWritable('open')).toBe(true);
    expect(isChatWritable('confirmed')).toBe(true);
    expect(isChatWritable('closed')).toBe(false);
    expect(isChatWritable('expired')).toBe(false);
    expect(isChatWritable('in_operation')).toBe(false);
  });
});

describe('draftStateOf', () => {
  it('un borrador en blanco no se puede enviar', () => {
    expect(draftStateOf('')).toBe('empty');
    expect(draftStateOf('   \n ')).toBe('empty');
  });

  it('admite hasta el máximo de caracteres y rechaza uno más', () => {
    expect(draftStateOf('a'.repeat(CHAT_MESSAGE_MAX_LENGTH))).toBe('ok');
    expect(draftStateOf('a'.repeat(CHAT_MESSAGE_MAX_LENGTH + 1))).toBe('too-long');
  });

  it('no cuenta los espacios de los extremos, como la API', () => {
    expect(draftStateOf(`  ${'a'.repeat(CHAT_MESSAGE_MAX_LENGTH)}  `)).toBe('ok');
  });
});

describe('formatCount', () => {
  it('separa los millares con punto incluso con cuatro cifras', () => {
    expect(formatCount(2000, 'es-ES')).toBe('2.000');
    expect(formatCount(2001, 'es-ES')).toBe('2.001');
    expect(formatCount(35, 'es-ES')).toBe('35');
  });
});

describe('chatItemsOf', () => {
  it('distingue los mensajes propios de los ajenos por el id del remitente', () => {
    const items = chatItemsOf([textFrom('Beto', 'Hola'), textFrom('Ana', 'Buenas', 1, ME)], [], ME);

    expect(items.map((item) => item.type === 'message' && item.mine)).toEqual([false, true]);
  });

  it('conserva el mensaje del sistema y el orden recibido', () => {
    const items = chatItemsOf([welcome(), textFrom('Beto', 'Hola', 1)], [], ME);

    expect(items.map((item) => item.type)).toEqual(['system', 'message']);
  });

  it('añade al final los envíos locales con su estado', () => {
    const items = chatItemsOf(
      [textFrom('Beto', 'Hola')],
      [outgoing({ stage: 'failed', failure: 'network' })],
      ME,
    );

    expect(items.at(-1)).toMatchObject({
      type: 'message',
      mine: true,
      text: 'Hola',
      state: 'failed',
      failure: 'network',
      outgoingKey: 'local-1',
    });
  });

  it('oculta el envío local cuando su mensaje ya ha llegado del canal', () => {
    const arrived = textFrom('Ana', 'Hola', 2, ME);
    const items = chatItemsOf([arrived], [outgoing({ stage: 'sent', serverId: arrived.id })], ME);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ key: arrived.id, state: 'sent' });
  });

  it('mantiene el envío ya aceptado por la API mientras su mensaje no llega', () => {
    const items = chatItemsOf([], [outgoing({ stage: 'sent', serverId: 'x' })], ME);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ state: 'sent', mine: true });
  });

  it('una imagen en envío enseña la foto local; la recibida, su imageId', () => {
    const items = chatItemsOf(
      [imageFrom('Beto', 'img-1')],
      [outgoing({ kind: 'image', uri: 'file:///foto.jpg' })],
      ME,
    );

    expect(items[0]).toMatchObject({ kind: 'image', imageId: 'img-1', mine: false });
    expect(items[1]).toMatchObject({ kind: 'image', localUri: 'file:///foto.jpg', mine: true });
  });

  describe('cuando el canal entrega el mensaje antes de que responda la API', () => {
    it('un envío sin serverId se da por llegado si hay un mensaje mío igual y nuevo en el canal', () => {
      const echo = textFrom('Ana', 'Hola', 41, ME);
      const items = chatItemsOf([echo], [outgoing({ seenRemoteIds: new Set() })], ME);

      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ key: echo.id, state: 'sent' });
    });

    it('dos envíos iguales seguidos con solo uno llegado se ven dos veces, no una ni tres', () => {
      const echo = textFrom('Ana', 'Hola', 41, ME);
      const items = chatItemsOf(
        [echo],
        [
          outgoing({ key: 'local-1', seenRemoteIds: new Set() }),
          outgoing({ key: 'local-2', seenRemoteIds: new Set() }),
        ],
        ME,
      );

      expect(items.map((item) => item.key)).toEqual([echo.id, 'local-2']);
    });

    it('con los dos llegados se ven solo los del canal', () => {
      const first = textFrom('Ana', 'Hola', 41, ME);
      const second = textFrom('Ana', 'Hola', 42, ME);
      const items = chatItemsOf(
        [first, second],
        [
          outgoing({ key: 'local-1', seenRemoteIds: new Set() }),
          outgoing({ key: 'local-2', seenRemoteIds: new Set() }),
        ],
        ME,
      );

      expect(items.map((item) => item.key)).toEqual([first.id, second.id]);
    });

    it('un mensaje de otra persona con el mismo texto no oculta el mío', () => {
      const theirs = textFrom('Beto', 'Hola', 41);
      const items = chatItemsOf([theirs], [outgoing({ seenRemoteIds: new Set() })], ME);

      expect(items.map((item) => item.key)).toEqual([theirs.id, 'local-1']);
    });

    it('un mensaje mío anterior al envío con el mismo texto no lo oculta', () => {
      const older = textFrom('Ana', 'Hola', 5, ME);
      const items = chatItemsOf([older], [outgoing({ seenRemoteIds: new Set([older.id]) })], ME);

      expect(items.map((item) => item.key)).toEqual([older.id, 'local-1']);
    });

    it('un mensaje ya reclamado por el serverId de otro envío no se reutiliza', () => {
      const claimed = textFrom('Ana', 'Hola', 41, ME);
      const items = chatItemsOf(
        [claimed],
        [
          outgoing({ key: 'local-1', stage: 'sent', serverId: claimed.id }),
          outgoing({ key: 'local-2', seenRemoteIds: new Set() }),
        ],
        ME,
      );

      expect(items.map((item) => item.key)).toEqual([claimed.id, 'local-2']);
    });

    it('una imagen mía nueva en el canal oculta el envío de imagen pendiente', () => {
      const echo = imageFrom('Ana', 'img-9', 41, ME);
      const items = chatItemsOf(
        [echo],
        [outgoing({ kind: 'image', uri: 'file:///foto.jpg', seenRemoteIds: new Set() })],
        ME,
      );

      expect(items.map((item) => item.key)).toEqual([echo.id]);
    });

    it('un texto mío no oculta un envío de imagen ni al revés', () => {
      const echo = textFrom('Ana', 'Hola', 41, ME);
      const items = chatItemsOf(
        [echo],
        [outgoing({ kind: 'image', uri: 'file:///foto.jpg', seenRemoteIds: new Set() })],
        ME,
      );

      expect(items.map((item) => item.key)).toEqual([echo.id, 'local-1']);
    });

    it('un envío fallido no se empareja con el canal', () => {
      const echo = textFrom('Ana', 'Hola', 41, ME);
      const items = chatItemsOf(
        [echo],
        [outgoing({ stage: 'failed', failure: 'network', seenRemoteIds: new Set() })],
        ME,
      );

      expect(items.map((item) => item.key)).toEqual([echo.id, 'local-1']);
    });
  });

  it('las claves de los elementos son únicas', () => {
    const items = chatItemsOf(
      [welcome(), textFrom('Beto', 'a', 1), textFrom('Beto', 'b', 2)],
      [outgoing(), outgoing({ key: 'local-2' })],
      ME,
    );

    expect(new Set(items.map((item) => item.key)).size).toBe(items.length);
  });
});

describe('failureOf', () => {
  it.each([
    ['network', 'network'],
    ['too-long', 'tooLong'],
    ['invalid', 'server'],
    ['not-open', 'closed'],
    ['not-ready', 'notReady'],
    ['invalid-image', 'invalidImage'],
    ['rate-limited', 'rateLimited'],
    ['busy', 'busy'],
    ['image-not-uploaded', 'network'],
    ['server', 'server'],
    ['unauthorized', 'server'],
  ] as const)('el error %s de la API se muestra como %s', (kind, expected) => {
    expect(failureOf(new ChatApiError(kind))).toBe(expected);
  });

  it('un fallo que no es de la API se trata como de red (p. ej. el envío del fichero)', () => {
    expect(failureOf(new Error('upload'))).toBe('network');
  });
});

describe('canRetry', () => {
  it('se reintenta lo que puede arreglarse solo con tiempo o conexión', () => {
    expect(canRetry('network')).toBe(true);
    expect(canRetry('server')).toBe(true);
    expect(canRetry('notReady')).toBe(true);
    expect(canRetry('rateLimited')).toBe(true);
    expect(canRetry('busy')).toBe(true);
  });

  it('no se reintenta lo que volvería a fallar igual', () => {
    expect(canRetry('tooLong')).toBe(false);
    expect(canRetry('invalidImage')).toBe(false);
    expect(canRetry('closed')).toBe(false);
  });
});

describe('imageUrlFreshForMs', () => {
  it('la URL vale hasta poco antes de caducar', () => {
    const now = new Date('2026-10-19T10:00:00Z').getTime();
    const expiresAt = new Date('2026-10-19T10:15:00Z');

    expect(imageUrlFreshForMs(expiresAt, now)).toBe(14 * 60_000);
  });

  it('una URL a punto de caducar o caducada no se reutiliza', () => {
    const now = new Date('2026-10-19T10:00:00Z').getTime();

    expect(imageUrlFreshForMs(new Date('2026-10-19T10:00:30Z'), now)).toBe(0);
    expect(imageUrlFreshForMs(new Date('2026-10-19T09:00:00Z'), now)).toBe(0);
  });
});

import { CHAT_MESSAGE_MAX_LENGTH } from '@changehouse/shared';
import { themes } from '@changehouse/ui';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Image } from 'expo-image';
import { AccessibilityInfo } from 'react-native';

import type { PhotoUploadTarget } from '../features/homes/photo-uploader';
import es from '../i18n/locales/es-ES.json';
import { authUser, FakeAuthService } from '../test-support/fake-auth-service';
import { FakeBackend, me } from '../test-support/fake-backend';
import {
  CHAT_ID,
  FakeChatApi,
  FakeChatMessages,
  imageFrom,
  textFrom,
  welcome,
} from '../test-support/fake-chat';
import { discoveryCard } from '../test-support/fake-discovery';
import { completeHome } from '../test-support/fake-homes';
import { fakeMatch, type FakeMatchOptions } from '../test-support/fake-matches';
import { FakePhotoPicker, pickedPhoto } from '../test-support/fake-photos';
import { renderSessionApp } from '../test-support/render-session-app';
import { styleOf } from '../test-utils';

// Flujos completos de la app (rutas, consultas y API simulada): el primero carga todos los módulos
jest.setTimeout(30_000);

const c = es.chat;
const ME = me({ roles: ['owner'], hasPublishedHome: true });
const LIMIT = '2.000';

const fill = (template: string, values: Record<string, string>) =>
  Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{{${key}}}`, value),
    template,
  );

const theirs = (name: string, time: string, text: string) =>
  fill(c.message.from, { name, time, text });
const mine = (time: string, text: string) => fill(c.message.fromMe, { time, text });
const failedText = (reason: string) => fill(c.status.failed, { reason });
const welcomeText = fill(c.welcome, { names: 'Ana, Beto' });
const tooLongReason = fill(c.failure.tooLong, { max: LIMIT });

let announce: jest.SpyInstance;

beforeEach(() => {
  jest.spyOn(Image, 'prefetch').mockResolvedValue(true);
  announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockReturnValue();
});

afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

interface ChatOptions {
  match?: Partial<Omit<FakeMatchOptions, 'mineHomeId' | 'theirHomeId' | 'chatId'>>;
  /** El chat de Firestore ya está creado (por defecto, sí). */
  chatReady?: boolean;
  /** Lo que ya hay en el chat (por defecto, solo el mensaje de bienvenida); `null` = aún sin respuesta. */
  seed?: Parameters<FakeChatMessages['seed']>[1] | null;
  theme?: 'light' | 'dark';
  /** Dirección con la que se abre la app (por defecto, el chat del match). */
  url?: string;
  /** El detalle del match responde con este estado de error la primera vez. */
  detailFailure?: number;
}

/** Una persona con un match con «Zona 1» y su chat abierto en la pantalla del chat. */
async function openChat({
  match: overrides = {},
  chatReady = true,
  seed,
  theme,
  url,
  detailFailure,
}: ChatOptions = {}) {
  const home = completeHome({ status: 'published' });
  const card = discoveryCard({
    location: { visibility: 'area', point: { lat: 40.4, lng: -3.7 }, areaName: 'Zona 1' },
  });
  const match = fakeMatch({
    mineHomeId: home.id,
    theirHomeId: card.id,
    ...(chatReady ? { chatId: CHAT_ID } : {}),
    ...overrides,
  });
  const backend = new FakeBackend({
    registered: true,
    profile: ME,
    homes: [home],
    discoveryCards: [card],
    matches: [match],
  });
  if (detailFailure !== undefined) backend.matches.rejectNextAction(detailFailure);
  const channel = new FakeChatMessages();
  if (seed !== null) channel.seed(CHAT_ID, seed ?? [welcome()]);
  const chatApi = new FakeChatApi({
    channel,
    chatId: CHAT_ID,
    sender: { id: ME.id, name: 'Ana' },
  });
  const photoPicker = new FakePhotoPicker();
  const uploaded: PhotoUploadTarget[] = [];
  const photoUploader = {
    failures: 0,
    upload: jest.fn((target: PhotoUploadTarget) => {
      if (photoUploader.failures > 0) {
        photoUploader.failures -= 1;
        return Promise.reject(new Error('Sin conexión con el almacenamiento'));
      }
      uploaded.push(target);
      return Promise.resolve();
    }),
  };
  const view = await renderSessionApp({
    auth: new FakeAuthService({ initialUser: authUser() }),
    backend,
    chatMessages: channel,
    chatApi,
    photoPicker,
    photoUploader,
    ...(theme ? { theme } : {}),
    url: url ?? `/match/${match.id}/chat`,
  });
  return { view, backend, channel, chatApi, photoPicker, uploaded, match, photoUploader };
}

const button = (name: string) => screen.getByRole('button', { name });
const isDisabled = (name: string) =>
  (button(name).props.accessibilityState as { disabled: boolean }).disabled;
const sendLabel = c.composer.send;

async function write(text: string) {
  await fireEvent.changeText(await screen.findByLabelText(c.composer.label), text);
}

async function send(text: string) {
  await write(text);
  await fireEvent.press(button(sendLabel));
}

/** Un mensaje de otro participante llega por el canal en tiempo real. */
async function receive(channel: FakeChatMessages, message: ReturnType<typeof textFrom>) {
  await act(async () => {
    channel.push(CHAT_ID, message);
    await Promise.resolve();
  });
}

describe('Chat del match', () => {
  it('mientras llega el primer mensaje enseña que está cargando y no el chat vacío', async () => {
    await openChat({ seed: null });

    expect(await screen.findByLabelText(c.loading)).toBeTruthy();
    expect(screen.queryByText(welcomeText)).toBeNull();
  });

  it('Scenario: Chat creado con el match - encuentra su chat con el mensaje del sistema que presenta a los participantes', async () => {
    await openChat();

    expect(await screen.findByText(welcomeText)).toBeTruthy();
    expect(screen.getByRole('header', { name: fill(c.title, { names: 'Beto' }) })).toBeTruthy();
  });

  it('Scenario: Mensaje en tiempo real - el mensaje del otro aparece sin recargar, con su nombre y la hora, y se anuncia', async () => {
    const { channel } = await openChat();
    await screen.findByText(welcomeText);

    await receive(channel, textFrom('Beto', '¿Te viene bien visitarla el sábado?', 5));

    expect(
      await screen.findByLabelText(theirs('Beto', '10:05', '¿Te viene bien visitarla el sábado?')),
    ).toBeTruthy();
    expect(screen.getByText('Beto')).toBeTruthy();
    expect(screen.getByText('10:05')).toBeTruthy();
    expect(announce).toHaveBeenCalledWith(
      fill(c.announce.received, { name: 'Beto', text: '¿Te viene bien visitarla el sábado?' }),
    );
  });

  it('el historial que ya estaba al abrir no se anuncia y el propio mensaje tampoco', async () => {
    const { channel } = await openChat({ seed: [welcome(), textFrom('Beto', 'Hola', 1)] });
    await screen.findByLabelText(theirs('Beto', '10:01', 'Hola'));

    await receive(channel, textFrom('Ana', 'Desde mi otro móvil', 2, ME.id));

    await screen.findByLabelText(mine('10:02', 'Desde mi otro móvil'));
    expect(announce).not.toHaveBeenCalled();
  });

  it('una imagen nueva de otro participante se anuncia', async () => {
    const { channel } = await openChat();
    await screen.findByText(welcomeText);

    await receive(channel, imageFrom('Beto', 'img-1', 4));

    await waitFor(() => {
      expect(announce).toHaveBeenCalledWith(fill(c.announce.receivedImage, { name: 'Beto' }));
    });
  });

  it('nunca enseña el email ni el teléfono de nadie', async () => {
    await openChat({ seed: [welcome(), textFrom('Beto', 'Hola', 1)] });
    await screen.findByLabelText(theirs('Beto', '10:01', 'Hola'));

    expect(screen.queryByText(/@/)).toBeNull();
    expect(screen.queryByText(/\+34/)).toBeNull();
  });

  it('los mensajes propios van a la derecha y los ajenos a la izquierda', async () => {
    await openChat({
      seed: [welcome(), textFrom('Beto', 'Hola', 1), textFrom('Ana', 'Buenas', 2, ME.id)],
    });

    const other = await screen.findByTestId('chat-row-other');
    const own = screen.getByTestId('chat-row-own');

    expect(styleOf(other).alignItems).toBe('flex-start');
    expect(styleOf(own).alignItems).toBe('flex-end');
  });

  it('al salir del chat deja de escuchar', async () => {
    const { channel, view } = await openChat();
    await screen.findByText(welcomeText);
    expect(channel.active).toBe(1);

    await fireEvent.press(button(c.back));

    await waitFor(() => {
      expect(channel.active).toBe(0);
    });
    expect(view.getPathname()).toMatch(/^\/match\/[^/]+$/);
  });

  it('si el canal falla enseña el error con reintento y vuelve a escuchar', async () => {
    const { channel } = await openChat();
    await screen.findByText(welcomeText);

    await act(async () => {
      channel.fail(CHAT_ID);
      await Promise.resolve();
    });

    expect(await screen.findByRole('header', { name: c.loadFailed.title })).toBeTruthy();
    await fireEvent.press(button(c.loadFailed.retry));
    expect(await screen.findByText(welcomeText)).toBeTruthy();
    expect(channel.subscriptions).toHaveLength(2);
  });

  it('el chat de un match inexistente o ajeno dice que ya no está disponible y lleva a «Matches»', async () => {
    const { view, channel } = await openChat({
      url: '/match/0198f3a0-eeee-7000-8000-000000000009/chat',
    });

    expect(await screen.findByRole('header', { name: es.matches.detail.gone.title })).toBeTruthy();
    expect(channel.subscriptions).toHaveLength(0);

    await fireEvent.press(button(es.matches.detail.gone.action));

    expect(view.getPathname()).toBe('/matches');
  });

  it('si el match no carga lo dice y «Reintentar» abre el chat', async () => {
    await openChat({ detailFailure: 500 });

    expect(
      await screen.findByRole('header', { name: es.matches.detail.loadFailed.title }),
    ).toBeTruthy();
    await fireEvent.press(button(es.matches.detail.loadFailed.retry));

    expect(await screen.findByText(welcomeText)).toBeTruthy();
  });

  it('si el match no carga se puede volver al detalle', async () => {
    const { view, match } = await openChat({ detailFailure: 500 });
    await screen.findByRole('header', { name: es.matches.detail.loadFailed.title });

    await fireEvent.press(button(c.back));

    expect(view.getPathname()).toBe(`/match/${match.id}`);
  });

  it('con el chat aún sin crear enseña que se está preparando y no escucha nada', async () => {
    const { channel } = await openChat({ chatReady: false, seed: null });

    expect(await screen.findByRole('header', { name: c.preparing.title })).toBeTruthy();
    expect(screen.queryByLabelText(c.composer.label)).toBeNull();
    expect(channel.subscriptions).toHaveLength(0);
  });
});

describe('Enviar mensajes', () => {
  it('Scenario: Mensaje en tiempo real - el mensaje enviado aparece al instante como «Enviando» y, al llegar, una sola vez y ya enviado', async () => {
    const { chatApi, match } = await openChat();
    const release = chatApi.hold();

    await send('¿Te viene bien el sábado?');

    expect(await screen.findByText(c.status.sending)).toBeTruthy();
    expect(screen.getByLabelText(/^Tú, \d{2}:\d{2}: ¿Te viene bien el sábado\?$/)).toBeTruthy();
    expect(screen.getByLabelText(c.composer.label).props.value).toBe('');
    expect(chatApi.sent).toEqual([
      { matchId: match.id, content: { text: '¿Te viene bien el sábado?' } },
    ]);

    await act(async () => {
      release();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.queryByText(c.status.sending)).toBeNull();
    });
    expect(screen.getAllByText('¿Te viene bien el sábado?')).toHaveLength(1);
  });

  it('no envía un mensaje en blanco: el botón está deshabilitado', async () => {
    const { chatApi } = await openChat();
    await screen.findByLabelText(c.composer.label);

    expect(isDisabled(sendLabel)).toBe(true);
    await write('   ');
    expect(isDisabled(sendLabel)).toBe(true);
    await fireEvent.press(button(sendLabel));

    expect(chatApi.sent).toHaveLength(0);
  });

  it('Scenario: Envío fallido - sin conexión el mensaje queda como «No enviado» con la opción de reintentar, y reintentar lo envía', async () => {
    const { chatApi } = await openChat();
    chatApi.failNext('network');

    await send('Hola, ¿sigues interesado?');

    expect(await screen.findByText(failedText(c.failure.network))).toBeTruthy();
    await fireEvent.press(button(c.status.retry));

    await waitFor(() => {
      expect(screen.queryByText(failedText(c.failure.network))).toBeNull();
    });
    expect(chatApi.sent).toHaveLength(2);
    expect(screen.getAllByText('Hola, ¿sigues interesado?')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: c.status.retry })).toBeNull();
  });

  it('un mensaje fallido se puede descartar', async () => {
    const { chatApi } = await openChat();
    chatApi.failNext('server');

    await send('Hola');
    await screen.findByText(failedText(c.failure.server));
    await fireEvent.press(button(c.status.discard));

    expect(screen.queryByText('Hola')).toBeNull();
    expect(chatApi.sent).toHaveLength(1);
  });

  it('con el chat aún sin crear (CHAT_NOT_READY) se puede reintentar', async () => {
    const { chatApi } = await openChat();
    chatApi.failNext('not-ready');

    await send('Hola');

    expect(await screen.findByText(failedText(c.failure.notReady))).toBeTruthy();
    expect(button(c.status.retry)).toBeTruthy();
  });

  it('Scenario: Mensaje demasiado largo - indica el límite con el contador y no deja enviar', async () => {
    const { chatApi } = await openChat();

    await write('a'.repeat(CHAT_MESSAGE_MAX_LENGTH));
    expect(screen.getByText(fill(c.composer.counter, { length: LIMIT, max: LIMIT }))).toBeTruthy();
    expect(isDisabled(sendLabel)).toBe(false);

    await write('a'.repeat(CHAT_MESSAGE_MAX_LENGTH + 1));

    expect(
      screen.getByText(fill(c.composer.counter, { length: '2.001', max: LIMIT })),
    ).toBeTruthy();
    expect(screen.getByText(fill(c.composer.tooLong, { max: LIMIT }))).toBeTruthy();
    expect(isDisabled(sendLabel)).toBe(true);
    await fireEvent.press(button(sendLabel));
    expect(chatApi.sent).toHaveLength(0);
  });

  it('Scenario: Mensaje demasiado largo - si la API lo rechaza con 400 el mensaje queda como no enviado y sin reintento', async () => {
    const { chatApi } = await openChat();
    chatApi.failNext('too-long');

    await send('Un mensaje');

    expect(await screen.findByText(failedText(tooLongReason))).toBeTruthy();
    expect(screen.queryByRole('button', { name: c.status.retry })).toBeNull();
    expect(button(c.status.discard)).toBeTruthy();
  });
});

describe('Imágenes', () => {
  it('Scenario: Imagen - elige una foto de la galería, la sube a la URL firmada y la envía con el id de la subida', async () => {
    const { chatApi, photoPicker, uploaded, match } = await openChat();
    photoPicker.choose(pickedPhoto('salon.jpg'));

    await fireEvent.press(await screen.findByRole('button', { name: c.composer.attach }));

    await waitFor(() => {
      expect(chatApi.sent).toHaveLength(1);
    });
    expect(photoPicker.limits).toEqual([1]);
    expect(chatApi.uploads).toEqual([{ matchId: match.id, contentType: 'image/jpeg' }]);
    expect(uploaded).toEqual([
      {
        url: 'https://storage.test/chat/1',
        contentType: 'image/jpeg',
        uri: 'file:///galeria/salon.jpg',
      },
    ]);
    expect(chatApi.sent[0]?.content).toEqual({ imageUploadId: expect.any(String) as string });
    expect(
      await screen.findByLabelText(fill(c.message.imageFromMe, { time: '10:30' })),
    ).toBeTruthy();
  });

  it('Scenario: Imagen - la imagen de otro participante se pide con su imageId, se enseña con texto alternativo y no se vuelve a pedir mientras vale', async () => {
    const { channel, chatApi, match } = await openChat({
      seed: [welcome(), imageFrom('Beto', 'img-1', 3)],
    });

    const image = await screen.findByLabelText(
      fill(c.message.imageFrom, { name: 'Beto', time: '10:03' }),
    );

    expect(image.props.source).toEqual([
      { uri: expect.stringContaining('/signed/img-1') as string },
    ]);
    expect(chatApi.imageRequests).toEqual([{ matchId: match.id, imageId: 'img-1' }]);

    await receive(channel, textFrom('Beto', 'Mira el salón', 4));
    await screen.findByLabelText(theirs('Beto', '10:04', 'Mira el salón'));

    expect(chatApi.imageRequests).toHaveLength(1);
  });

  it('una imagen que no se puede cargar enseña un aviso con reintento', async () => {
    const { chatApi } = await openChat({ seed: [welcome(), imageFrom('Beto', 'img-1', 3)] });
    chatApi.failNextImageUrl('network');

    expect(await screen.findByText(c.message.imageFailed)).toBeTruthy();
    await fireEvent.press(button(c.message.imageRetry));

    await waitFor(() => {
      expect(screen.queryByText(c.message.imageFailed)).toBeNull();
    });
    expect(chatApi.imageRequests).toHaveLength(2);
  });

  it('un fichero que no es una imagen admitida se rechaza con un aviso y no se envía nada', async () => {
    const { chatApi, photoPicker } = await openChat();
    photoPicker.choose(pickedPhoto('notas.txt', 'text/plain'));

    await fireEvent.press(await screen.findByRole('button', { name: c.composer.attach }));

    expect(await screen.findByText(c.attach.unsupported)).toBeTruthy();
    expect(chatApi.uploads).toHaveLength(0);
    expect(chatApi.sent).toHaveLength(0);
  });

  it('si la galería no se puede abrir lo dice', async () => {
    const { photoPicker } = await openChat();
    photoPicker.fails = true;

    await fireEvent.press(await screen.findByRole('button', { name: c.composer.attach }));

    expect(await screen.findByText(c.attach.galleryFailed)).toBeTruthy();
  });

  it('cancelar la galería no envía nada ni avisa', async () => {
    const { chatApi } = await openChat();

    await fireEvent.press(await screen.findByRole('button', { name: c.composer.attach }));

    expect(chatApi.uploads).toHaveLength(0);
    expect(screen.queryByText(c.attach.galleryFailed)).toBeNull();
  });

  it('si falla la subida de la imagen queda como no enviada y reintentar la sube de nuevo y la envía', async () => {
    const { chatApi, photoPicker, photoUploader, uploaded } = await openChat();
    photoPicker.choose(pickedPhoto('salon.jpg'));
    photoUploader.failures = 1;

    await fireEvent.press(await screen.findByRole('button', { name: c.composer.attach }));
    expect(await screen.findByText(failedText(c.failure.network))).toBeTruthy();
    expect(chatApi.sent).toHaveLength(0);

    await fireEvent.press(button(c.status.retry));

    await waitFor(() => {
      expect(chatApi.sent).toHaveLength(1);
    });
    expect(uploaded).toHaveLength(1);
  });

  it('si el envío falla tras subir la imagen, reintentar no la vuelve a subir y usa la misma subida', async () => {
    const { chatApi, photoPicker, uploaded } = await openChat();
    photoPicker.choose(pickedPhoto('salon.jpg'));
    chatApi.failNext('network');

    await fireEvent.press(await screen.findByRole('button', { name: c.composer.attach }));
    await screen.findByText(failedText(c.failure.network));
    await fireEvent.press(button(c.status.retry));

    await waitFor(() => {
      expect(chatApi.sent).toHaveLength(2);
    });
    expect(uploaded).toHaveLength(1);
    expect(chatApi.uploads).toHaveLength(1);
    expect(chatApi.sent[1]?.content).toEqual(chatApi.sent[0]?.content);
  });

  it('una imagen no válida (422) queda como no enviada y sin reintento', async () => {
    const { chatApi, photoPicker } = await openChat();
    photoPicker.choose(pickedPhoto('rota.jpg'));
    chatApi.failNext('invalid-image');

    await fireEvent.press(await screen.findByRole('button', { name: c.composer.attach }));

    expect(await screen.findByText(failedText(c.failure.invalidImage))).toBeTruthy();
    expect(screen.queryByRole('button', { name: c.status.retry })).toBeNull();
  });
});

describe('Chat de un match cerrado', () => {
  const closedByBeto = { status: 'closed', theirStatus: 'withdrawn' } as const;

  it('Scenario: Match cerrado - ve el historial y un aviso del motivo, y no puede enviar', async () => {
    await openChat({
      match: closedByBeto,
      seed: [welcome(), textFrom('Beto', 'Me retiro, lo siento', 6)],
    });

    expect(
      await screen.findByLabelText(theirs('Beto', '10:06', 'Me retiro, lo siento')),
    ).toBeTruthy();
    expect(screen.getByText(fill(c.readOnly.closedBy, { name: 'Beto' }))).toBeTruthy();
    expect(screen.queryByLabelText(c.composer.label)).toBeNull();
    expect(screen.queryByRole('button', { name: sendLabel })).toBeNull();
    expect(screen.queryByRole('button', { name: c.composer.attach })).toBeNull();
  });

  it('Scenario: Match cerrado - si quien se retiró fue la propia persona, el aviso lo dice así', async () => {
    await openChat({ match: { status: 'closed', mineStatus: 'withdrawn' } });

    expect(await screen.findByText(c.readOnly.closedByYou)).toBeTruthy();
  });

  it('un match caducado también es de solo lectura', async () => {
    await openChat({ match: { status: 'expired' } });

    expect(await screen.findByText(c.readOnly.expired)).toBeTruthy();
    expect(screen.queryByLabelText(c.composer.label)).toBeNull();
  });

  it('las imágenes del historial siguen viéndose con el match cerrado', async () => {
    const { chatApi } = await openChat({
      match: closedByBeto,
      seed: [welcome(), imageFrom('Beto', 'img-1', 3)],
    });

    await screen.findByLabelText(fill(c.message.imageFrom, { name: 'Beto', time: '10:03' }));

    await waitFor(() => {
      expect(chatApi.imageRequests).toHaveLength(1);
    });
  });

  it('Scenario: Match cerrado - si se cierra mientras escribe, la API responde 409 y el chat pasa a solo lectura', async () => {
    const { chatApi, backend, match } = await openChat();
    await screen.findByLabelText(c.composer.label);
    backend.matches.closeBehindTheScenes(match.id);
    chatApi.failNext('not-open');

    await send('¿Sigues ahí?');

    expect(await screen.findByText(fill(c.readOnly.closedBy, { name: 'Beto' }))).toBeTruthy();
    expect(screen.queryByLabelText(c.composer.label)).toBeNull();
    expect(screen.getByText(failedText(c.failure.closed))).toBeTruthy();
    expect(screen.queryByRole('button', { name: c.status.retry })).toBeNull();
  });
});

describe('Accesibilidad', () => {
  it('el campo tiene etiqueta, los botones tienen nombre y el de enviar se habilita al escribir', async () => {
    await openChat();
    await screen.findByLabelText(c.composer.label);

    expect(button(c.composer.attach)).toBeTruthy();
    expect(isDisabled(sendLabel)).toBe(true);
    await write('Hola');
    expect(isDisabled(sendLabel)).toBe(false);
  });

  it('el aviso de límite superado se anuncia como alerta', async () => {
    await openChat();
    await write('a'.repeat(CHAT_MESSAGE_MAX_LENGTH + 1));

    expect(screen.getByText(fill(c.composer.tooLong, { max: LIMIT }))).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
  });
});

describe('Tematización', () => {
  it.each(['light', 'dark'] as const)(
    'las burbujas y el fondo usan los tokens del tema %s',
    async (theme) => {
      await openChat({
        theme,
        seed: [welcome(), textFrom('Beto', 'Hola', 1), textFrom('Ana', 'Buenas', 2, ME.id)],
      });
      await screen.findByLabelText(theirs('Beto', '10:01', 'Hola'));

      expect(styleOf(screen.getByTestId('chat-root')).backgroundColor).toBe(themes[theme].color.bg);
      expect(styleOf(screen.getByTestId('chat-bubble-own')).backgroundColor).toBe(
        themes[theme].color.primary,
      );
      expect(styleOf(screen.getByTestId('chat-bubble-other')).backgroundColor).toBe(
        themes[theme].color.surfaceMuted,
      );
    },
  );
});

describe('Desde el detalle del match', () => {
  it('«Abrir chat» lleva al chat del match', async () => {
    const { view, match } = await openChat();
    await screen.findByText(welcomeText);
    await fireEvent.press(button(c.back));

    await fireEvent.press(await screen.findByRole('button', { name: es.matches.detail.chat.open }));

    expect(view.getPathname()).toBe(`/match/${match.id}/chat`);
    expect(await screen.findByLabelText(c.composer.label)).toBeTruthy();
  });
});

import { themes } from '@changehouse/ui';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Image } from 'expo-image';
import { AccessibilityInfo } from 'react-native';

import es from '../i18n/locales/es-ES.json';
import { authUser, FakeAuthService } from '../test-support/fake-auth-service';
import { FakeBackend, me } from '../test-support/fake-backend';
import {
  CHAT_ID,
  FakeChatApi,
  FakeChatMessages,
  OTHER_ID,
  textFrom,
  welcome,
} from '../test-support/fake-chat';
import { discoveryCard } from '../test-support/fake-discovery';
import { completeHome } from '../test-support/fake-homes';
import { fakeMatch } from '../test-support/fake-matches';
import { storedReport } from '../test-support/fake-reports';
import { renderSessionApp } from '../test-support/render-session-app';
import { styleOf, THEME_NAMES } from '../test-utils';

// Flujos completos de la app (rutas, formularios y API simulada): el primero carga todos los módulos
jest.setTimeout(30_000);

const m = es.moderation;
const a = es.admin.reports;
const OWNER = me({ roles: ['owner'], hasPublishedHome: true });
const ADMIN = me({ roles: ['admin'] });

const fill = (template: string, values: Record<string, string>) =>
  Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{{${key}}}`, value),
    template,
  );
const button = (name: string) => screen.getByRole('button', { name });
const moreOptions = (subject: string) => fill(m.more.label, { subject });
const messageSubject = (name: string, time: string) => fill(m.more.subject.message, { name, time });
const posts = (backend: FakeBackend, path: string) => backend.requestsTo('POST', path);

beforeEach(() => {
  jest.spyOn(Image, 'prefetch').mockResolvedValue(true);
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockReturnValue();
});

afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

/** Abre el menú «Más opciones» de ese sujeto y elige una de sus acciones. */
async function chooseOption(subject: string, option: string) {
  await fireEvent.press(await screen.findByRole('button', { name: moreOptions(subject) }));
  await fireEvent.press(await screen.findByRole('button', { name: option }));
}

/** Rellena la hoja de denuncia con un motivo frecuente y la envía. */
async function sendReport(reason: string = m.report.reasons.fake) {
  await fireEvent.press(await screen.findByRole('radio', { name: reason }));
  await fireEvent.press(button(m.report.send));
}

const areaCard = () =>
  discoveryCard({
    location: { visibility: 'area', point: { lat: 40.4, lng: -3.7 }, areaName: 'Zona 1' },
  });

// ---------------------------------------------------------------------------------------------
// Vivienda ajena (detalle desde la tarjeta)
// ---------------------------------------------------------------------------------------------

const HOME_TITLE = 'Piso en Zona 1';

async function openHomeDetail(theme?: 'light' | 'dark') {
  const card = areaCard();
  const backend = new FakeBackend({
    registered: true,
    profile: OWNER,
    homes: [completeHome({ status: 'published' })],
    discoveryCards: [card],
  });
  await renderSessionApp({
    auth: new FakeAuthService({ initialUser: authUser() }),
    backend,
    ...(theme ? { theme } : {}),
    url: `/discover/${card.id}`,
  });
  await screen.findByRole('header', { name: HOME_TITLE });
  return { backend, card };
}

describe('Denunciar una vivienda ajena', () => {
  it('Scenario: Denunciar una vivienda - con el motivo «Anuncio falso» la API responde 201 y se confirma que el equipo la revisará', async () => {
    const { backend, card } = await openHomeDetail();

    await chooseOption(HOME_TITLE, m.more.report);
    await sendReport();

    expect(await screen.findByText(m.report.sent)).toBeTruthy();
    expect(posts(backend, '/reports')).toHaveLength(1);
    expect(posts(backend, '/reports')[0]?.body).toEqual({
      targetType: 'home',
      targetId: card.id,
      reason: m.report.reasons.fake,
    });
  });

  it('la hoja ofrece motivos frecuentes y un campo de texto propio', async () => {
    await openHomeDetail();

    await chooseOption(HOME_TITLE, m.more.report);

    for (const reason of Object.values(m.report.reasons)) {
      expect(screen.getByRole('radio', { name: reason })).toBeTruthy();
    }
    expect(screen.getByLabelText(m.report.reasonLabel)).toBeTruthy();
  });

  it('acepta un motivo escrito con las propias palabras', async () => {
    const { backend } = await openHomeDetail();

    await chooseOption(HOME_TITLE, m.more.report);
    await fireEvent.changeText(
      screen.getByLabelText(m.report.reasonLabel),
      '  Las fotos no son suyas ',
    );
    await fireEvent.press(button(m.report.send));

    expect(await screen.findByText(m.report.sent)).toBeTruthy();
    expect(posts(backend, '/reports')[0]?.body).toMatchObject({
      reason: 'Las fotos no son suyas',
    });
  });

  it('sin motivo no envía nada y explica qué falta', async () => {
    const { backend } = await openHomeDetail();

    await chooseOption(HOME_TITLE, m.more.report);
    await fireEvent.press(button(m.report.send));

    expect(await screen.findByText(m.report.errors.required)).toBeTruthy();
    expect(posts(backend, '/reports')).toHaveLength(0);
  });

  it('un motivo de más de 1000 caracteres no se envía', async () => {
    const { backend } = await openHomeDetail();

    await chooseOption(HOME_TITLE, m.more.report);
    // `maxLength` del campo lo impide al escribir; un pegado desde fuera puede saltárselo
    await fireEvent.changeText(screen.getByLabelText(m.report.reasonLabel), 'a'.repeat(1001));
    await fireEvent.press(button(m.report.send));

    expect(await screen.findByText(m.report.errors.tooLong)).toBeTruthy();
    expect(posts(backend, '/reports')).toHaveLength(0);
  });

  it('Scenario: Límite de denuncias - ante un 429 lo explica, mantiene la hoja y permite reintentar', async () => {
    const { backend } = await openHomeDetail();
    backend.reports.rateLimited = true;

    await chooseOption(HOME_TITLE, m.more.report);
    await sendReport();

    expect(await screen.findByText(m.report.errors.rateLimited)).toBeTruthy();
    expect(screen.queryByText(m.report.sent)).toBeNull();

    backend.reports.rateLimited = false;
    await fireEvent.press(button(m.report.send));

    expect(await screen.findByText(m.report.sent)).toBeTruthy();
  });

  it.each([
    ['network', m.report.errors.network],
    ['server', m.report.errors.unknown],
    ['invalid', m.report.errors.invalid],
  ] as const)('un fallo «%s» se explica con un mensaje recuperable', async (failure, message) => {
    const { backend } = await openHomeDetail();
    backend.failNext = failure;

    await chooseOption(HOME_TITLE, m.more.report);
    await sendReport();

    expect(await screen.findByText(message)).toBeTruthy();
    expect(button(m.report.send)).toBeTruthy();
  });

  it('si la vivienda ya no existe (404) lo dice', async () => {
    const { backend, card } = await openHomeDetail();
    backend.reports.missing.add(card.id);

    await chooseOption(HOME_TITLE, m.more.report);
    await sendReport();

    expect(await screen.findByText(m.report.errors.notFound)).toBeTruthy();
  });

  it('cancelar cierra la hoja sin enviar nada', async () => {
    const { backend } = await openHomeDetail();

    await chooseOption(HOME_TITLE, m.more.report);
    await fireEvent.press(button(m.report.cancel));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: m.report.send })).toBeNull();
    });
    expect(posts(backend, '/reports')).toHaveLength(0);
  });

  it('el menú no ofrece «Bloquear» en una vivienda: el contrato no expone a su propietario', async () => {
    await openHomeDetail();

    await fireEvent.press(await screen.findByRole('button', { name: moreOptions(HOME_TITLE) }));

    expect(await screen.findByRole('button', { name: m.more.report })).toBeTruthy();
    expect(screen.queryByRole('button', { name: m.more.block })).toBeNull();
    await fireEvent.press(button(m.more.close));
  });

  it.each(THEME_NAMES)('en el tema %s la hoja usa los tokens del tema', async (theme) => {
    await openHomeDetail(theme);

    await chooseOption(HOME_TITLE, m.more.report);

    expect(styleOf(await screen.findByText(m.report.description)).color).toBe(
      themes[theme].color.textMuted,
    );
  });
});

// ---------------------------------------------------------------------------------------------
// Match
// ---------------------------------------------------------------------------------------------

async function openMatchDetail() {
  const home = completeHome({ status: 'published' });
  const card = areaCard();
  const match = fakeMatch({ mineHomeId: home.id, theirHomeId: card.id });
  const backend = new FakeBackend({
    registered: true,
    profile: OWNER,
    homes: [home],
    discoveryCards: [card],
    matches: [match],
  });
  await renderSessionApp({
    auth: new FakeAuthService({ initialUser: authUser() }),
    backend,
    url: `/match/${match.id}`,
  });
  await screen.findByRole('header', {
    name: es.matches.detail.title.replace('{{names}}', 'Beto'),
  });
  return { backend, card };
}

describe('Denunciar desde el detalle de un match', () => {
  it('denuncia la vivienda de la otra persona y confirma que el equipo la revisará', async () => {
    const { backend, card } = await openMatchDetail();

    await chooseOption('Beto', m.more.report);
    await sendReport(m.report.reasons.inappropriate);

    expect(await screen.findByText(m.report.sent)).toBeTruthy();
    expect(posts(backend, '/reports')[0]?.body).toEqual({
      targetType: 'home',
      targetId: card.id,
      reason: m.report.reasons.inappropriate,
    });
  });

  it('solo las demás personas tienen menú: la propia sección no se puede denunciar', async () => {
    await openMatchDetail();

    expect(await screen.findAllByRole('button', { name: new RegExp(m.more.action) })).toHaveLength(
      1,
    );
    expect(screen.queryByRole('button', { name: moreOptions('Ana') })).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------------------------

async function openChat() {
  const home = completeHome({ status: 'published' });
  const card = areaCard();
  const match = fakeMatch({ mineHomeId: home.id, theirHomeId: card.id, chatId: CHAT_ID });
  const backend = new FakeBackend({
    registered: true,
    profile: OWNER,
    homes: [home],
    discoveryCards: [card],
    matches: [match],
  });
  const offensive = textFrom('Beto', 'Eres un impresentable', 5);
  const own = textFrom('Ana', 'Hola, Beto', 6, OWNER.id);
  const channel = new FakeChatMessages();
  channel.seed(CHAT_ID, [welcome(), offensive, own]);
  await renderSessionApp({
    auth: new FakeAuthService({ initialUser: authUser() }),
    backend,
    chatMessages: channel,
    chatApi: new FakeChatApi({ channel, chatId: CHAT_ID, sender: { id: OWNER.id, name: 'Ana' } }),
    url: `/match/${match.id}/chat`,
  });
  await screen.findByText('Eres un impresentable');
  return { backend, offensive, match };
}

const BETO_MESSAGE = messageSubject('Beto', '10:05');

describe('Denunciar un mensaje del chat', () => {
  it('Scenario: Denunciar un mensaje - denuncia el mensaje ajeno por su identificador y confirma', async () => {
    const { backend, offensive } = await openChat();

    await chooseOption(BETO_MESSAGE, m.more.report);
    await sendReport(m.report.reasons.harassment);

    expect(await screen.findByText(m.report.sent)).toBeTruthy();
    expect(posts(backend, '/reports')[0]?.body).toEqual({
      targetType: 'message',
      targetId: offensive.id,
      reason: m.report.reasons.harassment,
    });
  });

  it('solo los mensajes ajenos tienen menú: ni los propios ni el aviso del sistema', async () => {
    await openChat();

    expect(await screen.findAllByRole('button', { name: new RegExp(m.more.action) })).toHaveLength(
      1,
    );
  });

  it('Scenario: Mensaje de un chat ajeno - si la API responde 404 lo dice sin cerrar la hoja', async () => {
    const { backend, offensive } = await openChat();
    backend.reports.missing.add(offensive.id);

    await chooseOption(BETO_MESSAGE, m.more.report);
    await sendReport();

    expect(await screen.findByText(m.report.errors.notFound)).toBeTruthy();
    expect(button(m.report.send)).toBeTruthy();
  });
});

describe('Bloquear desde el chat', () => {
  it('Scenario: El bloqueo cierra el match y su chat - tras bloquear, el chat queda en solo lectura y sin errores', async () => {
    const { backend, match } = await openChat();
    backend.matches.blockClosesMatch(OTHER_ID, match.id);

    await chooseOption(BETO_MESSAGE, m.more.block);
    await fireEvent.press(button(m.block.confirm));

    expect(await screen.findByText(fill(m.block.done, { name: 'Beto' }))).toBeTruthy();
    expect(await screen.findByText(es.chat.readOnly.closed)).toBeTruthy();
    expect(screen.queryByRole('button', { name: es.chat.composer.send })).toBeNull();
    expect(screen.queryByText(m.block.errors.unknown)).toBeNull();
  });

  it('Scenario: Bloquear - la confirmación explica que dejaréis de veros y no bloquea hasta confirmar', async () => {
    const { backend } = await openChat();

    await chooseOption(BETO_MESSAGE, m.more.block);

    expect(
      await screen.findByRole('header', { name: fill(m.block.title, { name: 'Beto' }) }),
    ).toBeTruthy();
    expect(screen.getByText(m.block.description)).toBeTruthy();
    expect(m.block.description).toMatch(/Dejaréis de veros/);
    expect(posts(backend, '/me/blocked-users')).toHaveLength(0);
  });

  it('al confirmar bloquea al remitente (204) y avisa del éxito', async () => {
    const { backend } = await openChat();

    await chooseOption(BETO_MESSAGE, m.more.block);
    await fireEvent.press(button(m.block.confirm));

    expect(await screen.findByText(fill(m.block.done, { name: 'Beto' }))).toBeTruthy();
    expect(posts(backend, '/me/blocked-users')[0]?.body).toEqual({ userId: OTHER_ID });
    expect(backend.reports.blocked).toEqual([OTHER_ID]);
  });

  it('cancelar la confirmación no bloquea a nadie', async () => {
    const { backend } = await openChat();

    await chooseOption(BETO_MESSAGE, m.more.block);
    await fireEvent.press(button(m.block.cancel));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: m.block.confirm })).toBeNull();
    });
    expect(posts(backend, '/me/blocked-users')).toHaveLength(0);
  });

  it('si falla, lo explica y «Reintentar» lo vuelve a intentar', async () => {
    const { backend } = await openChat();
    backend.failNext = 'network';

    await chooseOption(BETO_MESSAGE, m.more.block);
    await fireEvent.press(button(m.block.confirm));

    expect(await screen.findByText(fill(m.block.errors.network, { name: 'Beto' }))).toBeTruthy();

    await fireEvent.press(button(m.block.retry));

    expect(await screen.findByText(fill(m.block.done, { name: 'Beto' }))).toBeTruthy();
    expect(backend.reports.blocked).toEqual([OTHER_ID]);
  });

  it('si la persona ya no existe (404) lo dice', async () => {
    const { backend } = await openChat();
    backend.reports.missing.add(OTHER_ID);

    await chooseOption(BETO_MESSAGE, m.more.block);
    await fireEvent.press(button(m.block.confirm));

    expect(await screen.findByText(fill(m.block.errors.notFound, { name: 'Beto' }))).toBeTruthy();
  });

  it('el aviso se puede descartar con «Entendido»', async () => {
    await openChat();

    await chooseOption(BETO_MESSAGE, m.more.block);
    await fireEvent.press(button(m.block.confirm));
    await screen.findByText(fill(m.block.done, { name: 'Beto' }));
    await fireEvent.press(button(m.dismiss));

    expect(screen.queryByText(fill(m.block.done, { name: 'Beto' }))).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
// Administración: cola de denuncias
// ---------------------------------------------------------------------------------------------

const OLDER = storedReport({
  targetType: 'message',
  reason: 'Insultos en el chat',
  createdAt: '2026-10-10T10:00:00.000Z',
});
const NEWER = storedReport({
  targetType: 'home',
  reason: 'Anuncio falso',
  createdAt: '2026-10-12T10:00:00.000Z',
});
const CLOSED = storedReport({ reason: 'Ya resuelta', status: 'resolved' });
const reasonText = (reason: string) => fill(a.item.reason, { reason });
const patches = (backend: FakeBackend) => backend.requests.filter((r) => r.method === 'PATCH');

/** Un admin que abre «Administración». */
async function openAdmin(reports: ReturnType<typeof storedReport>[], theme?: 'light' | 'dark') {
  const backend = new FakeBackend({ registered: true, profile: ADMIN });
  backend.reports.seed(...reports);
  await renderSessionApp({
    auth: new FakeAuthService({ initialUser: authUser() }),
    backend,
    ...(theme ? { theme } : {}),
  });
  await fireEvent.press(await screen.findByRole('button', { name: es.tabs.admin }));
  await screen.findByRole('tab', { name: es.admin.tabs.reports });
  return { backend };
}

/** Un admin que abre «Administración» → «Denuncias». */
async function openReports(reports: ReturnType<typeof storedReport>[], theme?: 'light' | 'dark') {
  const opened = await openAdmin(reports, theme);
  await fireEvent.press(screen.getByRole('tab', { name: es.admin.tabs.reports }));
  await screen.findByRole('header', { name: a.title });
  return opened;
}

async function startResolving(reason: string, note: string, action: 'resolve' | 'dismiss') {
  const label = action === 'resolve' ? a.item.resolveLabel : a.item.dismissLabel;
  await fireEvent.press(await screen.findByRole('button', { name: fill(label, { reason }) }));
  if (note !== '') await fireEvent.changeText(await screen.findByLabelText(a.note.label), note);
  else await screen.findByLabelText(a.note.label);
}

describe('Cola de denuncias del admin', () => {
  it('Scenario: Revisar - muestra las abiertas de la más antigua a la más reciente con su motivo, objetivo y fecha', async () => {
    await openReports([NEWER, OLDER, CLOSED]);

    expect(await screen.findAllByTestId('report-card')).toHaveLength(2);
    expect(screen.queryByText(reasonText('Ya resuelta'))).toBeNull();
    expect(screen.getByText(fill(a.item.created, { date: '10 oct 2026' }))).toBeTruthy();
    expect(
      screen.getByText(
        fill(a.item.target, { type: a.item.targetType.message, id: OLDER.targetId }),
      ),
    ).toBeTruthy();
    const reasons = screen.getAllByText(/^Motivo: /).map((node) => node.props.children as string);
    expect(reasons).toEqual([reasonText('Insultos en el chat'), reasonText('Anuncio falso')]);
  });

  it('Scenario: Evidencia - la denuncia de un mensaje muestra el texto copiado y la fecha del mensaje', async () => {
    const withText = storedReport({
      targetType: 'message',
      reason: 'Insultos',
      evidence: {
        text: 'Eres un impresentable',
        senderId: OTHER_ID,
        sentAt: '2026-10-09T08:00:00.000Z',
      },
    });
    await openReports([withText]);

    expect(
      await screen.findByText(fill(a.item.evidence.text, { text: 'Eres un impresentable' })),
    ).toBeTruthy();
    expect(screen.getByText(fill(a.item.evidence.sent, { date: '9 oct 2026' }))).toBeTruthy();
  });

  it('la evidencia de una imagen se indica como «Imagen»', async () => {
    await openReports([
      storedReport({
        targetType: 'message',
        evidence: { text: null, senderId: OTHER_ID, sentAt: '2026-10-09T08:00:00.000Z' },
      }),
    ]);

    expect(await screen.findByText(a.item.evidence.image)).toBeTruthy();
  });

  it('una denuncia de vivienda no muestra evidencia', async () => {
    await openReports([NEWER]);

    await screen.findAllByTestId('report-card');
    expect(screen.queryByText(a.item.evidence.title)).toBeNull();
  });

  it('si la denuncia ya se resolvió (409) lo dice con su propio mensaje y actualiza la cola', async () => {
    const { backend } = await openReports([OLDER]);

    await startResolving('Insultos en el chat', 'Nota', 'resolve');
    const stored = backend.reports.reports[0];
    if (stored) stored.status = 'resolved';
    await fireEvent.press(button(a.resolve.confirm));

    expect(await screen.findByText(a.outcome.conflict)).toBeTruthy();
    expect(await screen.findByRole('header', { name: a.empty.title })).toBeTruthy();
  });

  it('sin denuncias abiertas lo dice', async () => {
    await openReports([CLOSED]);

    expect(await screen.findByRole('header', { name: a.empty.title })).toBeTruthy();
    expect(screen.getByText(a.empty.description)).toBeTruthy();
  });

  it('si la cola no carga lo explica y «Reintentar» la vuelve a pedir', async () => {
    const { backend } = await openAdmin([OLDER]);
    backend.failNext = 'server';
    await fireEvent.press(screen.getByRole('tab', { name: es.admin.tabs.reports }));

    expect(await screen.findByText(a.loadFailed)).toBeTruthy();

    await fireEvent.press(button(a.retry));

    expect(await screen.findAllByTestId('report-card')).toHaveLength(1);
  });

  it('pagina con «Cargar más»', async () => {
    const many = Array.from({ length: 11 }, (_, index) =>
      storedReport({
        reason: `Denuncia ${String(index + 1).padStart(2, '0')}`,
        createdAt: `2026-10-${String(index + 1).padStart(2, '0')}T10:00:00.000Z`,
      }),
    );
    await openReports(many);
    expect(await screen.findAllByTestId('report-card')).toHaveLength(10);

    await fireEvent.press(button(a.loadMore));

    await waitFor(() => {
      // La lista pinta por ventanas: lo que importa es qué datos acumula
      expect(screen.getByTestId('reports-queue').props.data).toHaveLength(11);
    });
    expect(screen.queryByRole('button', { name: a.loadMore })).toBeNull();
  });

  it('desde las denuncias se vuelve a las viviendas en revisión', async () => {
    await openReports([]);

    await fireEvent.press(button(a.back));

    expect(await screen.findByRole('header', { name: es.admin.queue.empty.title })).toBeTruthy();
  });

  it('Scenario: Resolver una denuncia - con una nota pasa a resolved y sale de la cola', async () => {
    const { backend } = await openReports([OLDER, NEWER]);

    await startResolving('Insultos en el chat', '  Mensajes ofensivos; avisado  ', 'resolve');
    await fireEvent.press(button(a.resolve.confirm));

    expect(await screen.findByText(a.outcome.resolved)).toBeTruthy();
    expect(patches(backend)[0]).toMatchObject({
      path: `/admin/reports/${OLDER.id}`,
      body: { status: 'resolved', resolution: 'Mensajes ofensivos; avisado' },
    });
    await waitFor(() => {
      expect(screen.queryByText(reasonText('Insultos en el chat'))).toBeNull();
    });
    expect(screen.getAllByTestId('report-card')).toHaveLength(1);
  });

  it('desestimar exige la misma nota y la denuncia sale de la cola', async () => {
    const { backend } = await openReports([NEWER]);

    await startResolving('Anuncio falso', 'Sin indicios', 'dismiss');
    await fireEvent.press(button(a.dismiss.confirm));

    expect(await screen.findByText(a.outcome.dismissed)).toBeTruthy();
    expect(patches(backend)[0]?.body).toEqual({ status: 'dismissed', resolution: 'Sin indicios' });
    expect(await screen.findByRole('header', { name: a.empty.title })).toBeTruthy();
  });

  it('la nota es obligatoria: sin ella no se envía nada', async () => {
    const { backend } = await openReports([OLDER]);

    await startResolving('Insultos en el chat', '', 'resolve');
    await fireEvent.press(button(a.resolve.confirm));

    expect(await screen.findByText(a.note.errors.required)).toBeTruthy();
    expect(patches(backend)).toHaveLength(0);
  });

  it('una nota de más de 2000 caracteres no se envía', async () => {
    const { backend } = await openReports([OLDER]);

    await startResolving('Insultos en el chat', 'a'.repeat(2001), 'resolve');
    await fireEvent.press(button(a.resolve.confirm));

    expect(await screen.findByText(a.note.errors.tooLong)).toBeTruthy();
    expect(patches(backend)).toHaveLength(0);
  });

  it('cancelar la nota cierra la hoja y la denuncia sigue abierta', async () => {
    const { backend } = await openReports([OLDER]);

    await startResolving('Insultos en el chat', '', 'resolve');
    await fireEvent.press(button(a.note.cancel));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: a.resolve.confirm })).toBeNull();
    });
    expect(patches(backend)).toHaveLength(0);
    expect(screen.getAllByTestId('report-card')).toHaveLength(1);
  });

  it('si falla el envío de la decisión lo explica y deja reintentar', async () => {
    const { backend } = await openReports([OLDER]);

    await startResolving('Insultos en el chat', 'Nota', 'resolve');
    backend.failNext = 'network';
    await fireEvent.press(button(a.resolve.confirm));

    expect(await screen.findByText(es.admin.failure.network)).toBeTruthy();

    await fireEvent.press(button(a.resolve.confirm));

    expect(await screen.findByText(a.outcome.resolved)).toBeTruthy();
  });

  it('si la denuncia ya no existe (404) avisa y actualiza la cola', async () => {
    const { backend } = await openReports([OLDER]);

    await startResolving('Insultos en el chat', 'Nota', 'resolve');
    backend.reports.reports.length = 0;
    await fireEvent.press(button(a.resolve.confirm));

    expect(await screen.findByText(a.outcome.gone)).toBeTruthy();
    expect(await screen.findByRole('header', { name: a.empty.title })).toBeTruthy();
  });

  it.each(THEME_NAMES)('en el tema %s la cola usa los tokens del tema', async (theme) => {
    await openReports([OLDER], theme);

    const reason = await screen.findByText(reasonText('Insultos en el chat'));
    expect(styleOf(screen.getByRole('header', { name: a.title })).color).toBe(
      themes[theme].color.text,
    );
    expect(styleOf(reason).color).toBe(themes[theme].color.text);
  });
});

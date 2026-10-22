import { themes } from '@changehouse/ui';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import * as ExpoHaptics from 'expo-haptics';
import { Image } from 'expo-image';
import { AccessibilityInfo, Linking } from 'react-native';

import { formatEuros } from '../features/homes/home-form';
import es from '../i18n/locales/es-ES.json';
import { button, openExplore, OWNER, published, zoneCards } from '../test-support/explore-harness';
import { me } from '../test-support/fake-backend';
import { fakeMatch } from '../test-support/fake-matches';
import { styleOf } from '../test-utils';

// Flujos completos de la app (rutas, consultas y API simulada): el primero carga todos los módulos
jest.setTimeout(30_000);

const d = es.matches.detail;
const mt = es.matches;
const PHONE = '+34600111222';
const THEIR_PHONE = '+34611222333';
const THEIR_ADDRESS = 'Calle del Prado 3, 28014 Madrid';
const OWNER_WITH_PHONE = me({ roles: ['owner'], hasPublishedHome: true, phone: PHONE });

let announce: jest.SpyInstance;

beforeEach(() => {
  jest.spyOn(Image, 'prefetch').mockResolvedValue(true);
  announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockReturnValue();
});

afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

type Row = Parameters<typeof within>[0];
type MatchOptions = Parameters<typeof fakeMatch>[0];

const pay = (cents: number) => `Tú pagas ${formatEuros(cents)}`;
const isDisabled = (name: string) => button(name).props.accessibilityState as { disabled: boolean };
const participants = () => screen.getAllByTestId('match-participant') as [Row, Row];
const theirPhoneLabel = d.phone.call.replace('{{name}}', 'Beto').replace('{{phone}}', THEIR_PHONE);
const notShared = d.phone.notShared.replace('{{name}}', 'Beto');
const shareSwitch = () => screen.getByRole('switch', { name: d.contact.share });
const isChecked = () => (shareSwitch().props.accessibilityState as { checked: boolean }).checked;

interface DetailOptions {
  match?: Partial<Omit<MatchOptions, 'mineHomeId' | 'theirHomeId'>>;
  theme?: 'light' | 'dark';
  profile?: typeof OWNER;
  url?: string;
}

/** Una persona con un match con «Zona 1» abierto en su pantalla de detalle. */
async function openDetail({
  match: overrides = {},
  theme,
  profile = OWNER_WITH_PHONE,
  url,
}: DetailOptions = {}) {
  const home = published();
  const cards = zoneCards(1);
  const card = cards[0];
  if (!card) throw new Error('Sin tarjeta');
  const match = fakeMatch({ mineHomeId: home.id, theirHomeId: card.id, ...overrides });
  const opened = await openExplore({
    homes: [home],
    cards,
    matches: [match],
    profile,
    ...(theme ? { theme } : {}),
    url: url ?? `/match/${match.id}`,
  });
  opened.backend.matches.setAddress(card.id, THEIR_ADDRESS);
  return { ...opened, home, card, match };
}

const title = () => screen.findByRole('header', { name: d.title.replace('{{names}}', 'Beto') });

/** El gesto de tirar para refrescar del detalle. */
async function pullToRefresh() {
  const scroll = screen.getByTestId('match-detail-scroll');
  await act(async () => {
    (scroll.props.refreshControl as { props: { onRefresh: () => void } }).props.onRefresh();
    await Promise.resolve();
  });
}

describe('Detalle del match', () => {
  it('Scenario: Participante ve el detalle - ve la dirección exacta de la otra casa, su galería completa, el nombre del otro y su compensación', async () => {
    const { card } = await openDetail({ match: { compensationCents: 1_200_000 } });

    await title();
    const [theirs, mine] = participants();
    expect(
      within(theirs).getByRole('header', { name: d.home.theirs.replace('{{name}}', 'Beto') }),
    ).toBeTruthy();
    expect(
      within(theirs).getByText(d.home.address.replace('{{address}}', THEIR_ADDRESS)),
    ).toBeTruthy();
    expect(within(theirs).getAllByRole('image')).toHaveLength(card.photos.length);
    expect(within(theirs).getByText(/Piso en Zona 1/)).toBeTruthy();
    expect(within(mine).getByRole('header', { name: d.home.yours })).toBeTruthy();
    expect(within(mine).getByText(pay(1_200_000))).toBeTruthy();
    expect(within(mine).getByText(es.discovery.compensation.disclaimer)).toBeTruthy();
    const theirCompensation = d.compensation.receive
      .replace('{{name}}', 'Beto')
      .replace('{{amount}}', formatEuros(1_200_000));
    expect(within(theirs).getByText(theirCompensation)).toBeTruthy();
    expect(within(theirs).getByText(es.discovery.compensation.disclaimer)).toBeTruthy();
  });

  it('un cambio justo no lleva importe en ninguno de los dos', async () => {
    await openDetail({ match: { compensationCents: 0 } });

    await title();
    const [theirs, mine] = participants();
    expect(within(mine).getByText(es.discovery.compensation.fair)).toBeTruthy();
    expect(within(theirs).getByText(d.compensation.fair.replace('{{name}}', 'Beto'))).toBeTruthy();
  });

  it('dice el estado con texto, cuántos han confirmado y qué falta', async () => {
    await openDetail();

    await title();
    expect(screen.getByText(mt.status.open)).toBeTruthy();
    expect(screen.getByText(mt.kind.direct)).toBeTruthy();
    expect(
      screen.getByText(d.progress.replace('{{confirmed}}', '0').replace('{{total}}', '2')),
    ).toBeTruthy();
    expect(screen.getByText(d.hint.open)).toBeTruthy();
    const [theirs, mine] = participants();
    expect(within(theirs).getByText(d.participantStatus.theirs.pending)).toBeTruthy();
    expect(within(mine).getByText(d.participantStatus.mine.pending)).toBeTruthy();
  });

  it('Scenario: Sin autorización - no ve el teléfono del otro y se le dice por qué', async () => {
    await openDetail();

    await title();
    expect(within(participants()[0]).getByText(notShared)).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('el teléfono que el otro autoriza aparece como enlace tel: y desaparece si lo revoca', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const { backend, card, match } = await openDetail();
    backend.matches.setPhone(card.id, THEIR_PHONE);
    await title();
    backend.matches.setSharing(match.id, card.id, true);

    await pullToRefresh();

    await fireEvent.press(await screen.findByRole('link', { name: theirPhoneLabel }));
    expect(open).toHaveBeenCalledWith(`tel:${THEIR_PHONE}`);
    expect(screen.queryByText(notShared)).toBeNull();

    backend.matches.setSharing(match.id, card.id, false);
    await pullToRefresh();

    expect(await screen.findByText(notShared)).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('Scenario: Autorizar y revocar - el interruptor guarda cada cambio al instante y lo anuncia', async () => {
    const { backend, match } = await openDetail();
    await title();
    expect(isChecked()).toBe(false);
    expect(screen.getByText(d.contact.shareHint)).toBeTruthy();

    await fireEvent.press(shareSwitch());

    await waitFor(() => {
      expect(isChecked()).toBe(true);
    });
    await waitFor(() => {
      expect(announce).toHaveBeenCalledWith(d.announce.shared);
    });
    await fireEvent.press(shareSwitch());
    await waitFor(() => {
      expect(isChecked()).toBe(false);
    });
    await waitFor(() => {
      expect(announce).toHaveBeenCalledWith(d.announce.unshared);
    });
    expect(
      backend.requestsTo('PUT', `/matches/${match.id}/phone-sharing`).map((r) => r.body),
    ).toEqual([{ share: true }, { share: false }]);
  });

  it('si no se puede guardar la preferencia, el interruptor vuelve a su valor y se explica', async () => {
    const { backend } = await openDetail();
    await title();
    backend.matches.rejectNextAction(500);

    await fireEvent.press(shareSwitch());

    expect(await screen.findByText(d.errors.phone)).toBeTruthy();
    await waitFor(() => {
      expect(isChecked()).toBe(false);
    });
  });

  it('el interruptor refleja lo guardado y avisa si no hay teléfono en el perfil', async () => {
    const { backend, home, match } = await openDetail({ profile: OWNER });
    await title();
    backend.matches.setSharing(match.id, home.id, true);

    await pullToRefresh();

    await waitFor(() => {
      expect(isChecked()).toBe(true);
    });
    expect(screen.getByText(d.contact.missingPhone)).toBeTruthy();
  });

  it('Scenario: Primera confirmación - «Confirmar interés» queda confirmado, el match sigue pendiente y se anuncia', async () => {
    const { backend, match } = await openDetail();
    await title();
    expect(isDisabled(d.actions.confirm).disabled).toBe(false);

    await fireEvent.press(button(d.actions.confirm));

    expect(await screen.findByText(d.participantStatus.mine.confirmed)).toBeTruthy();
    expect(isDisabled(d.actions.confirmed).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: d.actions.confirm })).toBeNull();
    expect(screen.getByText(d.actions.waiting)).toBeTruthy();
    expect(screen.getByText(mt.status.open)).toBeTruthy();
    expect(
      screen.getByText(d.progress.replace('{{confirmed}}', '1').replace('{{total}}', '2')),
    ).toBeTruthy();
    expect(announce).toHaveBeenCalledWith(d.announce.confirmed);
    expect(ExpoHaptics.notificationAsync).toHaveBeenCalledWith(
      ExpoHaptics.NotificationFeedbackType.Success,
    );
    expect(backend.requestsTo('POST', `/matches/${match.id}/confirm`)).toHaveLength(1);
  });

  it('Scenario: Todos confirman - al confirmar el último el detalle muestra «Confirmado por todos»', async () => {
    await openDetail({ match: { theirStatus: 'confirmed' } });
    await title();

    await fireEvent.press(button(d.actions.confirm));

    expect(await screen.findByText(mt.status.confirmed)).toBeTruthy();
    expect(screen.getByText(d.hint.confirmed)).toBeTruthy();
    expect(screen.queryByText(mt.status.open)).toBeNull();
    expect(announce).toHaveBeenCalledWith(d.announce.allConfirmed);
    // Aún se puede compartir el teléfono y retirarse
    expect(shareSwitch()).toBeTruthy();
    expect(button(d.actions.withdraw)).toBeTruthy();
  });

  it('un match ya confirmado por todos se abre con su estado y sin «Confirmar interés»', async () => {
    await openDetail({
      match: { status: 'confirmed', mineStatus: 'confirmed', theirStatus: 'confirmed' },
    });

    expect(await screen.findByText(mt.status.confirmed)).toBeTruthy();
    expect(screen.queryByRole('button', { name: d.actions.confirm })).toBeNull();
    expect(isDisabled(d.actions.confirmed).disabled).toBe(true);
  });

  it('mientras se guarda la confirmación el botón no admite otra pulsación', async () => {
    const { backend, match } = await openDetail();
    await title();
    const release = backend.hold();

    await fireEvent.press(button(d.actions.confirm));

    // Mientras guarda, el botón está ocupado y deshabilitado: otra pulsación no hace nada
    await waitFor(() => {
      expect(screen.getByLabelText(d.actions.confirm).props.accessibilityState).toMatchObject({
        busy: true,
        disabled: true,
      });
    });
    await fireEvent.press(screen.getByLabelText(d.actions.confirm));
    release();
    expect(await screen.findByText(d.participantStatus.mine.confirmed)).toBeTruthy();
    expect(backend.requestsTo('POST', `/matches/${match.id}/confirm`)).toHaveLength(1);
  });

  it('Scenario: Match cerrado - se ve cerrado, quién se retiró y no ofrece ninguna acción', async () => {
    await openDetail({ match: { status: 'closed', theirStatus: 'withdrawn' } });

    expect(await screen.findByText(mt.status.closed)).toBeTruthy();
    expect(screen.getByText(d.closedBy.replace('{{name}}', 'Beto'))).toBeTruthy();
    expect(screen.getByText(d.hint.closed)).toBeTruthy();
    expect(screen.queryByRole('button', { name: d.actions.confirm })).toBeNull();
    expect(screen.queryByRole('button', { name: d.actions.withdraw })).toBeNull();
    expect(screen.queryByRole('switch')).toBeNull();
    // Cerrado, ya no se enseña dónde vive ni cómo localizarle
    expect(screen.queryByText(d.home.address.replace('{{address}}', THEIR_ADDRESS))).toBeNull();
    expect(screen.queryByText(notShared)).toBeNull();
  });

  it('si el match se cierra mientras tanto, confirmar lo explica y deja la pantalla al día', async () => {
    const { backend, match } = await openDetail();
    await title();
    backend.matches.closeBehindTheScenes(match.id);

    await fireEvent.press(button(d.actions.confirm));

    expect(await screen.findByText(d.errors.conflict)).toBeTruthy();
    expect(await screen.findByText(mt.status.closed)).toBeTruthy();
    expect(screen.queryByRole('button', { name: d.actions.confirm })).toBeNull();
  });

  it('un fallo al confirmar dice qué hacer y deja volver a intentarlo', async () => {
    const { backend } = await openDetail();
    await title();
    backend.matches.rejectNextAction(500);

    await fireEvent.press(button(d.actions.confirm));

    expect(await screen.findByText(d.errors.server)).toBeTruthy();
    expect(isDisabled(d.actions.confirm).disabled).toBe(false);
    await fireEvent.press(button(d.actions.confirm));
    expect(await screen.findByText(d.participantStatus.mine.confirmed)).toBeTruthy();
    expect(screen.queryByText(d.errors.server)).toBeNull();
  });

  it('sin conexión al confirmar lo dice con su propio mensaje', async () => {
    const { backend } = await openDetail();
    await title();
    backend.failNext = 'network';

    await fireEvent.press(button(d.actions.confirm));

    expect(await screen.findByText(d.errors.network)).toBeTruthy();
  });

  it('Scenario: Confirmación de la retirada - «Retirarme» pide confirmar y explica que el match se cierra para todos', async () => {
    const { backend, match } = await openDetail();
    await title();

    await fireEvent.press(button(d.actions.withdraw));

    const dialog = await screen.findByLabelText(d.withdrawDialog.title);
    expect(within(dialog).getByText(d.withdrawDialog.description)).toBeTruthy();
    expect(d.withdrawDialog.description).toMatch(/cerrará para todos los participantes/);
    expect(backend.requestsTo('POST', `/matches/${match.id}/withdraw`)).toHaveLength(0);

    await fireEvent.press(button(d.withdrawDialog.cancel));

    await waitFor(() => {
      expect(screen.queryByLabelText(d.withdrawDialog.title)).toBeNull();
    });
    expect(backend.requestsTo('POST', `/matches/${match.id}/withdraw`)).toHaveLength(0);
    expect(screen.getByText(mt.status.open)).toBeTruthy();
  });

  it('Scenario: Retirarse - al confirmar, el match queda cerrado para todos y se anuncia', async () => {
    const { backend, match } = await openDetail();
    await title();
    await fireEvent.press(button(d.actions.withdraw));
    await screen.findByLabelText(d.withdrawDialog.title);

    await fireEvent.press(button(d.withdrawDialog.confirm));

    expect(await screen.findByText(mt.status.closed)).toBeTruthy();
    expect(screen.getByText(d.closedByYou)).toBeTruthy();
    expect(screen.queryByLabelText(d.withdrawDialog.title)).toBeNull();
    expect(screen.queryByRole('button', { name: d.actions.withdraw })).toBeNull();
    expect(announce).toHaveBeenCalledWith(d.announce.withdrawn);
    expect(backend.requestsTo('POST', `/matches/${match.id}/withdraw`)).toHaveLength(1);
  });

  it('si la retirada falla se explica y el match sigue como estaba', async () => {
    const { backend } = await openDetail();
    await title();
    await fireEvent.press(button(d.actions.withdraw));
    await screen.findByLabelText(d.withdrawDialog.title);
    backend.matches.rejectNextAction(500);

    await fireEvent.press(button(d.withdrawDialog.confirm));

    expect(await screen.findByText(d.errors.server)).toBeTruthy();
    expect(screen.queryByLabelText(d.withdrawDialog.title)).toBeNull();
    expect(screen.getByText(mt.status.open)).toBeTruthy();
  });

  it('un match inexistente o ajeno dice que ya no está disponible y vuelve a «Matches»', async () => {
    const { view } = await openDetail({ url: '/match/0198f3a0-eeee-7000-8000-000000000009' });

    expect(await screen.findByRole('header', { name: d.gone.title })).toBeTruthy();
    expect(screen.getByText(d.gone.description)).toBeTruthy();

    await fireEvent.press(button(d.gone.action));

    expect(view.getPathname()).toBe('/matches');
    expect(await screen.findByRole('header', { name: mt.title })).toBeTruthy();
  });

  it('si el detalle no carga lo dice y «Reintentar» lo vuelve a pedir', async () => {
    const { backend } = await openDetail({ url: '/matches' });
    await screen.findAllByTestId('match-row');
    backend.matches.rejectNextAction(500);

    await fireEvent.press(screen.getAllByTestId('match-row')[0] as Row);

    expect(await screen.findByRole('header', { name: d.loadFailed.title })).toBeTruthy();
    await fireEvent.press(button(d.loadFailed.retry));
    expect(await title()).toBeTruthy();
  });

  it('el botón volver sale del detalle', async () => {
    const { view } = await openDetail();
    await title();

    await fireEvent.press(button(d.back));

    expect(view.getPathname()).toBe('/matches');
  });
});

describe('Desde la lista', () => {
  it('pulsar una fila abre su detalle y, tras retirarse, la lista ya lo muestra cerrado sin recargar a mano', async () => {
    const { view, match } = await openDetail({ url: '/matches' });
    const [row] = (await screen.findAllByTestId('match-row')) as [Row];
    expect(within(row).getByText(mt.status.open)).toBeTruthy();

    await fireEvent.press(row);

    expect(await title()).toBeTruthy();
    expect(view.getPathname()).toBe(`/match/${match.id}`);
    await fireEvent.press(button(d.actions.withdraw));
    await fireEvent.press(await screen.findByRole('button', { name: d.withdrawDialog.confirm }));
    await screen.findByText(mt.status.closed);

    await fireEvent.press(button(d.back));

    expect(view.getPathname()).toBe('/matches');
    await waitFor(() => {
      expect(
        within(screen.getAllByTestId('match-row')[0] as Row).getByText(mt.status.closed),
      ).toBeTruthy();
    });
  });

  it('la fila se anuncia como botón que abre el detalle', async () => {
    await openDetail({ url: '/matches' });

    const [row] = (await screen.findAllByTestId('match-row')) as [Row];

    expect(row.props.accessibilityRole).toBe('button');
    expect(row.props.accessibilityHint).toBe(mt.row.open);
  });
});

describe('Tematización', () => {
  it.each(['light', 'dark'] as const)('el detalle usa los tokens del tema %s', async (theme) => {
    await openDetail({ theme, match: { theirStatus: 'confirmed' } });

    const header = await title();

    expect(styleOf(header).color).toBe(themes[theme].color.text);
    expect(styleOf(screen.getByTestId('match-detail-root')).backgroundColor).toBe(
      themes[theme].color.bg,
    );
    expect(styleOf(screen.getAllByTestId('match-participant')[0] as Row).backgroundColor).toBe(
      themes[theme].color.surface,
    );
    expect(styleOf(screen.getByTestId('switch-track')).borderColor).toBe(
      themes[theme].color.borderStrong,
    );
  });
});

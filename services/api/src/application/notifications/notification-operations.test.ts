import { describe, expect, it } from 'vitest';

import {
  FakeEmailNotifier,
  FakePushNotifier,
  InMemoryChatSetup,
  InMemoryDeviceRepository,
  InMemoryOutbox,
  InMemoryUserContactDirectory,
} from '../../../test/fakes.js';
import { OutboxDispatcher } from '../outbox/outbox-dispatcher.js';
import { notificationHandlers, notificationOperations } from './notification-operations.js';

const MATCH_ID = 'match-1';
const ANA = 'user-ana';
const BETO = 'user-beto';
const NOW = new Date('2026-10-20T09:00:00.000Z');
const APP_URL = 'https://app.test';
const LATER = new Date('2026-10-21T09:00:00.000Z');

function setup() {
  const devices = new InMemoryDeviceRepository();
  const push = new FakePushNotifier();
  const roster = new InMemoryChatSetup();
  roster.rosters.set(MATCH_ID, {
    matchId: MATCH_ID,
    chatId: MATCH_ID,
    members: [
      { userId: ANA, firebaseUid: 'uid-ana', displayName: 'Ana' },
      { userId: BETO, firebaseUid: 'uid-beto', displayName: 'Beto' },
    ],
  });
  const email = new FakeEmailNotifier();
  const contacts = new InMemoryUserContactDirectory();
  contacts.contacts.set('uid-ana', { email: 'ana@example.com', emailVerified: true });
  contacts.contacts.set('uid-beto', { email: 'beto@example.com', emailVerified: true });
  const operations = notificationOperations({
    devices,
    roster,
    push,
    email,
    contacts,
    appUrl: APP_URL,
    clock: { now: () => NOW },
  });
  return { operations, devices, push, roster, email, contacts };
}

async function withDevices() {
  const env = setup();
  await env.operations.registerDevice(ANA, { fcmToken: 'tok-ana-1', platform: 'android' });
  await env.operations.registerDevice(ANA, { fcmToken: 'tok-ana-2', platform: 'web' });
  await env.operations.registerDevice(BETO, { fcmToken: 'tok-beto', platform: 'ios' });
  return env;
}

describe('registerDevice', () => {
  it('Scenario: Alta - guarda el token con la cuenta, la plataforma y el instante', async () => {
    const { operations, devices } = setup();

    await operations.registerDevice(ANA, { fcmToken: 'tok-1', platform: 'android' });

    expect([...devices.rows.values()]).toEqual([
      { fcmToken: 'tok-1', userId: ANA, platform: 'android', at: NOW },
    ]);
  });

  it('Scenario: Refresco - el mismo token otra vez deja una sola fila actualizada', async () => {
    const devices = new InMemoryDeviceRepository();
    let now = NOW;
    const operations = notificationOperations({
      devices,
      roster: new InMemoryChatSetup(),
      push: new FakePushNotifier(),
      email: new FakeEmailNotifier(),
      contacts: new InMemoryUserContactDirectory(),
      appUrl: APP_URL,
      clock: { now: () => now },
    });
    await operations.registerDevice(ANA, { fcmToken: 'tok-1', platform: 'android' });
    now = LATER;

    await operations.registerDevice(ANA, { fcmToken: 'tok-1', platform: 'ios' });

    expect([...devices.rows.values()]).toEqual([
      { fcmToken: 'tok-1', userId: ANA, platform: 'ios', at: LATER },
    ]);
  });
});

describe('avisos push', () => {
  it('Scenario: Nuevo match - cada participante con dispositivo recibe «¡Tienes un match!» con el tipo y el match, y nada más', async () => {
    const { operations, push } = await withDevices();

    await operations.notifyMatchCreated(MATCH_ID);

    expect(push.sent).toHaveLength(1);
    expect([...(push.sent[0]?.tokens ?? [])].sort()).toEqual([
      'tok-ana-1',
      'tok-ana-2',
      'tok-beto',
    ]);
    expect(push.sent[0]?.notification).toMatchObject({
      title: '¡Tienes un match!',
      data: { type: 'match.created', matchId: MATCH_ID },
    });
    expect(Object.keys(push.sent[0]?.notification.data ?? {}).sort()).toEqual(['matchId', 'type']);
  });

  it('Scenario: Nuevo mensaje - solo el otro participante lo recibe, con el nombre visible del remitente y sin el contenido', async () => {
    const { operations, push } = await withDevices();

    await operations.notifyMessageSent({ matchId: MATCH_ID, senderId: ANA });

    expect(push.sent).toHaveLength(1);
    expect(push.sent[0]?.tokens).toEqual(['tok-beto']);
    expect(push.sent[0]?.notification).toMatchObject({
      title: 'Nuevo mensaje de Ana',
      data: { type: 'message.sent', matchId: MATCH_ID },
    });
  });

  it('Scenario: Match confirmado - todos los participantes reciben un aviso genérico', async () => {
    const { operations, push } = await withDevices();

    await operations.notifyMatchConfirmed(MATCH_ID);

    expect(push.sent[0]?.notification).toMatchObject({
      title: '¡Match confirmado!',
      data: { type: 'match.confirmed', matchId: MATCH_ID },
    });
    expect(push.sent[0]?.tokens).toHaveLength(3);
  });

  it('Scenario: Match cerrado - todos los participantes reciben «Tu match se ha cerrado»', async () => {
    const { operations, push } = await withDevices();

    await operations.notifyMatchClosed(MATCH_ID);

    expect(push.sent[0]?.notification).toMatchObject({
      title: 'Tu match se ha cerrado',
      data: { type: 'match.closed', matchId: MATCH_ID },
    });
    expect(push.sent[0]?.tokens).toHaveLength(3);
  });

  it('un participante sin dispositivos no impide avisar al otro, y si nadie tiene no se llama al servicio', async () => {
    const { operations, push } = setup();
    await operations.notifyMatchCreated(MATCH_ID);
    expect(push.sent).toEqual([]);

    await operations.registerDevice(BETO, { fcmToken: 'tok-beto', platform: 'ios' });
    await operations.notifyMatchCreated(MATCH_ID);

    expect(push.sent.map((sent) => sent.tokens)).toEqual([['tok-beto']]);
  });

  it('un match que ya no existe, o un remitente que no participa, no avisa a nadie ni falla', async () => {
    const { operations, push } = await withDevices();

    await operations.notifyMatchCreated('no-existe');
    await operations.notifyMessageSent({ matchId: 'no-existe', senderId: ANA });
    await operations.notifyMessageSent({ matchId: MATCH_ID, senderId: 'intruso' });

    expect(push.sent).toEqual([]);
  });
});

describe('avisos por email', () => {
  it('Scenario: Email de nuevo match - cada participante con email verificado recibe «Tienes un match en ChangeHouse» con el enlace al match', async () => {
    const { operations, email } = setup();

    await operations.notifyMatchCreated(MATCH_ID);

    expect(email.sent.map((sent) => [sent.to, sent.subject])).toEqual([
      ['ana@example.com', 'Tienes un match en ChangeHouse'],
      ['beto@example.com', 'Tienes un match en ChangeHouse'],
    ]);
    expect(email.sent[0]?.text).toContain('https://app.test/match/match-1');
    expect(email.sent[0]?.html).toContain('<a href="https://app.test/match/match-1"');
  });

  it('Scenario: Email de match cerrado - lo reciben los participantes verificados', async () => {
    const { operations, email } = setup();

    await operations.notifyMatchClosed(MATCH_ID);

    expect(email.sent.map((sent) => sent.subject)).toEqual([
      'Tu match de ChangeHouse se ha cerrado',
      'Tu match de ChangeHouse se ha cerrado',
    ]);
  });

  it('sin email verificado, sin email o sin cuenta en Firebase no se envía nada y no es un error', async () => {
    const { operations, email, contacts } = setup();
    contacts.contacts.set('uid-ana', { email: 'ana@example.com', emailVerified: false });
    contacts.contacts.delete('uid-beto');

    await expect(operations.notifyMatchCreated(MATCH_ID)).resolves.toBeUndefined();
    contacts.contacts.set('uid-beto', { email: null, emailVerified: true });
    await operations.notifyMatchClosed(MATCH_ID);

    expect(email.sent).toEqual([]);
  });

  it('confirmado y mensaje nuevo avisan solo por push', async () => {
    const { operations, email } = setup();

    await operations.notifyMatchConfirmed(MATCH_ID);
    await operations.notifyMessageSent({ matchId: MATCH_ID, senderId: ANA });

    expect(email.sent).toEqual([]);
  });

  it('Scenario: Fallo del envío - si el correo o la consulta de contacto fallan, lanza para que el despachador reintente', async () => {
    const { operations, email, contacts } = setup();
    email.failures = 1;
    await expect(operations.notifyMatchCreated(MATCH_ID)).rejects.toThrow('Correo');
    contacts.failures = 1;
    await expect(operations.notifyMatchClosed(MATCH_ID)).rejects.toThrow('Firebase Auth');
  });

  it('el email no lleva importes, teléfonos ni direcciones', async () => {
    const { operations, email } = setup();

    await operations.notifyMatchCreated(MATCH_ID);
    await operations.notifyMatchClosed(MATCH_ID);

    const everything = email.sent.map((sent) => sent.subject + sent.text + sent.html).join('');
    expect(everything).not.toMatch(/€|euro|\+34|calle/i);
  });
});

describe('cierre con destinatarios filtrados (bloqueo)', () => {
  it('Scenario: El bloqueo cierra el match - quien bloquea no recibe ni el push ni el email', async () => {
    const { operations, push, email } = await withDevices();

    await operations.notifyMatchClosed(MATCH_ID, [BETO]);

    expect(push.sent).toHaveLength(1);
    expect(push.sent[0]?.tokens).toEqual(['tok-beto']);
    expect(email.sent.map((sent) => sent.to)).toEqual(['beto@example.com']);
  });

  it('el hecho match.closed lleva sus destinatarios en la carga y se respetan al despachar', async () => {
    const env = await withDevices();
    const outbox = new InMemoryOutbox();
    const dispatcher = new OutboxDispatcher({
      store: outbox,
      handlers: notificationHandlers(env.operations),
      clock: { now: () => NOW },
      intervalMs: 30_000,
      onError: () => undefined,
    });
    await outbox.enqueue({
      id: 'e1',
      type: 'match.closed',
      aggregateId: MATCH_ID,
      payload: { recipients: BETO },
      at: NOW,
    });

    expect(await dispatcher.dispatch()).toEqual({ processed: 1, failed: 0 });

    expect(env.push.sent[0]?.tokens).toEqual(['tok-beto']);
  });

  it('sin destinatarios en la carga se avisa a todos, como hasta ahora', async () => {
    const { operations, push } = await withDevices();

    await operations.notifyMatchClosed(MATCH_ID);

    expect(push.sent[0]?.tokens).toHaveLength(3);
  });
});

describe('contenido sin datos privados', () => {
  it('GIVEN un mensaje con una dirección WHEN se genera su aviso THEN ningún texto ni dato la contiene', async () => {
    const { operations, push } = await withDevices();

    // El manejador solo conoce ids: el texto "Calle Mayor 5, +34600111222, 1.200.000 €" nunca le llega
    await operations.notifyMessageSent({ matchId: MATCH_ID, senderId: ANA });
    await operations.notifyMatchCreated(MATCH_ID);
    await operations.notifyMatchConfirmed(MATCH_ID);
    await operations.notifyMatchClosed(MATCH_ID);

    const everything = JSON.stringify(push.sent.map((sent) => sent.notification));
    expect(everything).not.toMatch(/Calle|Mayor|\+34|600111222|1\.200|€|euro/i);
    expect(push.sent).toHaveLength(4);
  });
});

describe('tokens inválidos', () => {
  it('Scenario: Token inválido - los que el servicio rechaza se eliminan y los demás se conservan', async () => {
    const { operations, push, devices } = await withDevices();
    push.invalidTokens = ['tok-ana-2'];

    await operations.notifyMatchCreated(MATCH_ID);

    expect([...devices.rows.keys()].sort()).toEqual(['tok-ana-1', 'tok-beto']);
    push.sent.length = 0;
    await operations.notifyMatchCreated(MATCH_ID);
    expect(push.sent[0]?.tokens).not.toContain('tok-ana-2');
  });
});

describe('despacho desde la bandeja de salida', () => {
  function dispatcherFor(env: Awaited<ReturnType<typeof withDevices>>) {
    const outbox = new InMemoryOutbox();
    const errors: unknown[] = [];
    const dispatcher = new OutboxDispatcher({
      store: outbox,
      handlers: notificationHandlers(env.operations),
      clock: { now: () => NOW },
      intervalMs: 30_000,
      onError: (error) => errors.push(error),
    });
    return { outbox, dispatcher, errors };
  }

  it('cada tipo de hecho llega a su aviso, con la carga del mensaje', async () => {
    const env = await withDevices();
    const { outbox, dispatcher } = dispatcherFor(env);
    await outbox.enqueue({ id: 'e1', type: 'match.created', aggregateId: MATCH_ID, at: NOW });
    await outbox.enqueue({ id: 'e2', type: 'match.confirmed', aggregateId: MATCH_ID, at: NOW });
    await outbox.enqueue({ id: 'e3', type: 'match.closed', aggregateId: MATCH_ID, at: NOW });
    await outbox.enqueue({
      id: 'e4',
      type: 'message.sent',
      aggregateId: 'mensaje-1',
      payload: { matchId: MATCH_ID, senderId: BETO },
      at: NOW,
    });

    expect(await dispatcher.dispatch()).toEqual({ processed: 4, failed: 0 });

    expect(env.push.sent.map((sent) => sent.notification.data.type)).toEqual([
      'match.created',
      'match.confirmed',
      'match.closed',
      'message.sent',
    ]);
    expect([...(env.push.sent[3]?.tokens ?? [])].sort()).toEqual(['tok-ana-1', 'tok-ana-2']);
  });

  it('Scenario: Fallo del envío - el hecho queda pendiente, se reintenta y acaba enviado sin tocar nada más', async () => {
    const env = await withDevices();
    const { outbox, dispatcher, errors } = dispatcherFor(env);
    env.push.failures = 1;
    await outbox.enqueue({ id: 'e1', type: 'match.created', aggregateId: MATCH_ID, at: NOW });

    expect(await dispatcher.dispatch()).toEqual({ processed: 0, failed: 1 });
    expect(outbox.events[0]).toMatchObject({ attempts: 1, processedAt: null });
    expect(errors).toHaveLength(1);
    expect(env.push.sent).toEqual([]);

    expect(await dispatcher.dispatch()).toEqual({ processed: 1, failed: 0 });
    expect(outbox.events[0]?.processedAt).toEqual(NOW);
    expect(env.push.sent).toHaveLength(1);
  });

  it('un message.sent sin carga queda pendiente como error: no se pierde en silencio', async () => {
    const env = await withDevices();
    const { outbox, dispatcher } = dispatcherFor(env);
    await outbox.enqueue({ id: 'e1', type: 'message.sent', aggregateId: 'mensaje-1', at: NOW });

    expect(await dispatcher.dispatch()).toEqual({ processed: 0, failed: 1 });
    expect(env.push.sent).toEqual([]);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';

import { InMemoryOutbox } from '../../../test/fakes.js';
import { OutboxDispatcher } from './outbox-dispatcher.js';

const NOW = new Date('2026-10-20T09:00:00.000Z');
const INTERVAL_MS = 30_000;

afterEach(() => {
  vi.useRealTimers();
});

async function enqueue(outbox: InMemoryOutbox, aggregateId: string, type = 'match.created') {
  await outbox.enqueue({ id: `evento-${aggregateId}`, type, aggregateId, at: NOW });
}

function setup(handle: (aggregateId: string) => Promise<void> = () => Promise.resolve()) {
  const outbox = new InMemoryOutbox();
  const handled: string[] = [];
  const errors: { error: unknown; eventId: string }[] = [];
  const dispatcher = new OutboxDispatcher({
    store: outbox,
    handlers: {
      'match.created': async (aggregateId) => {
        handled.push(aggregateId);
        await handle(aggregateId);
      },
    },
    clock: { now: () => NOW },
    intervalMs: INTERVAL_MS,
    onError: (error, event) => errors.push({ error, eventId: event.id }),
  });
  return { outbox, dispatcher, handled, errors };
}

describe('OutboxDispatcher.dispatch', () => {
  it('entrega cada hecho pendiente a su manejador y lo da por procesado', async () => {
    const { outbox, dispatcher, handled } = setup();
    await enqueue(outbox, 'm1');
    await enqueue(outbox, 'm2');

    const summary = await dispatcher.dispatch();

    expect(summary).toEqual({ processed: 2, failed: 0 });
    expect(handled).toEqual(['m1', 'm2']);
    expect(outbox.events.map((event) => event.processedAt)).toEqual([NOW, NOW]);
    expect(await dispatcher.dispatch()).toEqual({ processed: 0, failed: 0 });
    expect(handled).toHaveLength(2);
  });

  it('GIVEN un fallo al despachar WHEN se reintenta THEN el hecho sigue pendiente, cuenta el intento y acaba procesado una vez', async () => {
    let failures = 1;
    const { outbox, dispatcher, handled, errors } = setup(() => {
      if (failures-- > 0) return Promise.reject(new Error('Firestore no disponible'));
      return Promise.resolve();
    });
    await enqueue(outbox, 'm1');

    const first = await dispatcher.dispatch();
    expect(first).toEqual({ processed: 0, failed: 1 });
    expect(outbox.events[0]).toMatchObject({ attempts: 1, processedAt: null });
    expect(errors).toHaveLength(1);
    expect(errors[0]?.eventId).toBe('evento-m1');

    const second = await dispatcher.dispatch();
    expect(second).toEqual({ processed: 1, failed: 0 });
    expect(outbox.events[0]).toMatchObject({ attempts: 1, processedAt: NOW });
    expect(handled).toEqual(['m1', 'm1']);
  });

  it('un fallo no detiene los demás hechos', async () => {
    const { outbox, dispatcher } = setup((id) =>
      id === 'm1' ? Promise.reject(new Error('fallo')) : Promise.resolve(),
    );
    await enqueue(outbox, 'm1');
    await enqueue(outbox, 'm2');

    expect(await dispatcher.dispatch()).toEqual({ processed: 1, failed: 1 });
  });

  it('un tipo de hecho sin manejador queda pendiente y se registra como error', async () => {
    const { outbox, dispatcher, errors } = setup();
    await enqueue(outbox, 'm1', 'desconocido');

    expect(await dispatcher.dispatch()).toEqual({ processed: 0, failed: 1 });

    expect(outbox.events[0]?.processedAt).toBeNull();
    expect(String(errors[0]?.error)).toContain('desconocido');
  });

  it('dos llamadas simultáneas comparten la ejecución y un hecho que llega durante ella se despacha después', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((done) => {
      release = done;
    });
    const { outbox, dispatcher, handled } = setup(() => gate);
    await enqueue(outbox, 'm1');

    const first = dispatcher.dispatch();
    await vi.waitFor(() => {
      expect(handled).toEqual(['m1']);
    });
    await enqueue(outbox, 'm2');
    const second = dispatcher.dispatch();
    release();
    await Promise.all([first, second]);

    expect(handled).toEqual(['m1', 'm2']);
    expect(outbox.events.every((event) => event.processedAt !== null)).toBe(true);
  });
});

describe('OutboxDispatcher - carga del hecho', () => {
  it('entrega al manejador el agregado y la carga registrada con el hecho (nula si no la tiene)', async () => {
    const outbox = new InMemoryOutbox();
    const received: [string, unknown][] = [];
    const dispatcher = new OutboxDispatcher({
      store: outbox,
      handlers: {
        'message.sent': (aggregateId, payload) => {
          received.push([aggregateId, payload]);
          return Promise.resolve();
        },
      },
      clock: { now: () => NOW },
      intervalMs: INTERVAL_MS,
      onError: () => undefined,
    });
    await outbox.enqueue({
      id: 'e1',
      type: 'message.sent',
      aggregateId: 'mensaje-1',
      payload: { matchId: 'm1', senderId: 'u1' },
      at: NOW,
    });
    await outbox.enqueue({ id: 'e2', type: 'message.sent', aggregateId: 'mensaje-2', at: NOW });

    await dispatcher.dispatch();

    expect(received).toEqual([
      ['mensaje-1', { matchId: 'm1', senderId: 'u1' }],
      ['mensaje-2', null],
    ]);
  });
});

describe('OutboxDispatcher.kick, start y stop', () => {
  it('kick despacha sin esperar y nunca lanza, aunque falle el almacén', async () => {
    const outbox = new InMemoryOutbox();
    vi.spyOn(outbox, 'processPending').mockRejectedValue(new Error('base de datos caída'));
    const errors: unknown[] = [];
    const dispatcher = new OutboxDispatcher({
      store: outbox,
      handlers: {},
      clock: { now: () => NOW },
      intervalMs: INTERVAL_MS,
      onError: (error) => errors.push(error),
    });

    dispatcher.kick();
    await dispatcher.stop();

    expect(errors).toHaveLength(1);
  });

  it('start despacha al arrancar y reintenta cada intervalo; stop lo detiene', async () => {
    vi.useFakeTimers();
    const { outbox, dispatcher, handled } = setup();
    await enqueue(outbox, 'm1');

    dispatcher.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(handled).toEqual(['m1']);

    await enqueue(outbox, 'm2');
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(handled).toEqual(['m1', 'm2']);

    await dispatcher.stop();
    await enqueue(outbox, 'm3');
    await vi.advanceTimersByTimeAsync(INTERVAL_MS * 3);
    expect(handled).toEqual(['m1', 'm2']);
  });

  it('start dos veces no duplica el temporizador', async () => {
    vi.useFakeTimers();
    const { outbox, dispatcher } = setup();
    const spy = vi.spyOn(outbox, 'processPending');

    dispatcher.start();
    dispatcher.start();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    await dispatcher.stop();

    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('stop espera a la ejecución en curso', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((done) => {
      release = done;
    });
    const { outbox, dispatcher, handled } = setup(() => gate);
    await enqueue(outbox, 'm1');
    dispatcher.kick();
    await vi.waitFor(() => {
      expect(handled).toEqual(['m1']);
    });

    let stopped = false;
    const stopping = dispatcher.stop().then(() => {
      stopped = true;
    });
    await Promise.resolve();
    expect(stopped).toBe(false);
    release();
    await stopping;

    expect(outbox.events[0]?.processedAt).toEqual(NOW);
  });
});

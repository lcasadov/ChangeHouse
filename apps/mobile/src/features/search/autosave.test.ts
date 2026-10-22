import { AutoSaver } from './autosave';

interface Deferred {
  value: number;
  resolve: () => void;
  reject: () => void;
}

/** Un guardado controlado por la prueba: cada llamada queda pendiente hasta resolverla o rechazarla. */
function setup() {
  const calls: Deferred[] = [];
  const saved: number[] = [];
  const failed: number[] = [];
  const saver = new AutoSaver<number>({
    delayMs: 600,
    save: (value) =>
      new Promise<number>((resolve, reject) => {
        calls.push({
          value,
          resolve: () => resolve(value * 10),
          reject: () => reject(new Error('x')),
        });
      }),
    onSaved: (result) => saved.push(result),
    onFailed: (value) => failed.push(value),
  });
  return { saver, calls, saved, failed };
}

const MICROTASK_TURNS = 10;

/** Deja correr las promesas encadenadas del guardado sin avanzar el reloj simulado. */
const flushPromises = async () => {
  for (let turn = 0; turn < MICROTASK_TURNS; turn += 1) await Promise.resolve();
};

describe('AutoSaver', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('espera 600 ms sin cambios antes de guardar y junta varios cambios en una sola petición', async () => {
    const { saver, calls } = setup();

    saver.schedule(1);
    jest.advanceTimersByTime(500);
    saver.schedule(2);
    jest.advanceTimersByTime(500);
    expect(calls).toHaveLength(0);

    jest.advanceTimersByTime(100);
    await flushPromises();

    expect(calls.map((call) => call.value)).toEqual([2]);
  });

  it('con una petición en vuelo no lanza otra: guarda después el último estado y descarta los intermedios', async () => {
    const { saver, calls, saved } = setup();
    saver.schedule(1);
    jest.advanceTimersByTime(600);
    await flushPromises();
    expect(calls).toHaveLength(1);

    saver.schedule(2);
    jest.advanceTimersByTime(600);
    saver.schedule(3);
    jest.advanceTimersByTime(600);
    await flushPromises();
    expect(calls).toHaveLength(1);

    calls[0]?.resolve();
    await flushPromises();

    expect(calls.map((call) => call.value)).toEqual([1, 3]);
    calls[1]?.resolve();
    await flushPromises();
    expect(saved).toEqual([10, 30]);
  });

  it('si falla el último guardado avisa con el valor que no se pudo guardar', async () => {
    const { saver, calls, failed, saved } = setup();
    saver.schedule(1);
    jest.advanceTimersByTime(600);
    await flushPromises();

    calls[0]?.reject();
    await flushPromises();

    expect(failed).toEqual([1]);
    expect(saved).toEqual([]);
  });

  it('un fallo que ya tiene un cambio posterior en cola no deshace nada: el siguiente guardado lo sustituye', async () => {
    const { saver, calls, failed, saved } = setup();
    saver.schedule(1);
    jest.advanceTimersByTime(600);
    await flushPromises();
    saver.schedule(2);
    jest.advanceTimersByTime(600);

    calls[0]?.reject();
    await flushPromises();
    expect(failed).toEqual([]);

    calls[1]?.resolve();
    await flushPromises();
    expect(saved).toEqual([20]);
  });

  it('saveNow guarda enseguida, espera a la petición en vuelo y devuelve el resultado', async () => {
    const { saver, calls } = setup();
    saver.schedule(1);
    jest.advanceTimersByTime(600);
    await flushPromises();

    const outcome = saver.saveNow(2);
    await flushPromises();
    expect(calls).toHaveLength(1);

    calls[0]?.resolve();
    await flushPromises();
    expect(calls).toHaveLength(2);
    calls[1]?.resolve();

    await expect(outcome).resolves.toEqual({ status: 'saved', saved: 20 });
  });

  it('saveNow devuelve el error si falla', async () => {
    const { saver, calls } = setup();

    const outcome = saver.saveNow(1);
    await flushPromises();
    calls[0]?.reject();

    await expect(outcome).resolves.toMatchObject({ status: 'failed' });
  });

  it('saveNow cancela el guardado diferido pendiente: ya incluye ese cambio', async () => {
    const { saver, calls } = setup();
    saver.schedule(1);

    void saver.saveNow(2);
    jest.advanceTimersByTime(1000);
    await flushPromises();

    expect(calls.map((call) => call.value)).toEqual([2]);
  });

  it('flush guarda al instante lo que esté pendiente (al salir de la pantalla)', async () => {
    const { saver, calls } = setup();
    saver.schedule(5);

    saver.flush();
    await flushPromises();

    expect(calls.map((call) => call.value)).toEqual([5]);
  });

  it('flush sin nada pendiente no hace nada', async () => {
    const { saver, calls } = setup();

    saver.flush();
    await flushPromises();

    expect(calls).toHaveLength(0);
  });

  it('cancel descarta lo pendiente', async () => {
    const { saver, calls } = setup();
    saver.schedule(5);

    saver.cancel();
    jest.advanceTimersByTime(1000);
    await flushPromises();

    expect(calls).toHaveLength(0);
  });
});

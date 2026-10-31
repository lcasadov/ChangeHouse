import { createAccountSuspensionSignal } from './account-suspension';

describe('createAccountSuspensionSignal', () => {
  it('avisa a cada suscriptor y deja de avisar al que se da de baja', () => {
    const signal = createAccountSuspensionSignal();
    const first = jest.fn();
    const second = jest.fn();
    const unsubscribe = signal.subscribe(first);
    signal.subscribe(second);

    signal.notify();
    unsubscribe();
    signal.notify();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
  });

  it('sin suscriptores, avisar no hace nada', () => {
    expect(() => {
      createAccountSuspensionSignal().notify();
    }).not.toThrow();
  });
});

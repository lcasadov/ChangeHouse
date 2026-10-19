import { randomBytes } from 'node:crypto';

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { AddressCipher } from './address-cipher.js';

const key = () => randomBytes(32);
const cipherWith = (...keys: [number, Buffer][]) => new AddressCipher(new Map(keys), keys[0]![0]);

describe('AddressCipher', () => {
  it('Scenario: Ubicación y dirección privada - descifrar con la misma clave devuelve el texto original', () => {
    const cipher = cipherWith([1, key()]);

    const stored = cipher.encrypt('Calle del Pez, 12, 28004 Madrid');

    expect(cipher.decrypt(stored)).toBe('Calle del Pez, 12, 28004 Madrid');
  });

  it('Scenario: Ubicación y dirección privada - descifrar con otra clave falla', () => {
    const stored = cipherWith([1, key()]).encrypt('Calle del Pez, 12');

    expect(() => cipherWith([1, key()]).decrypt(stored)).toThrow();
  });

  it('el texto guardado no contiene la dirección en claro y empieza por la versión de la clave', () => {
    const stored = cipherWith([7, key()]).encrypt('Calle del Pez, 12');

    expect(stored[0]).toBe(7);
    expect(stored.toString('utf8')).not.toContain('Calle del Pez');
  });

  it('dos cifrados del mismo texto son distintos (IV aleatorio)', () => {
    const cipher = cipherWith([1, key()]);

    expect(cipher.encrypt('igual').equals(cipher.encrypt('igual'))).toBe(false);
  });

  it('rechaza un texto cifrado manipulado', () => {
    const cipher = cipherWith([1, key()]);
    const stored = cipher.encrypt('Calle del Pez, 12');
    const last = stored.length - 1;
    stored[last] = (stored[last] ?? 0) ^ 0xff;

    expect(() => cipher.decrypt(stored)).toThrow();
  });

  it('rechaza un texto cifrado cuya versión de clave se ha cambiado (va autenticada)', () => {
    const shared = key();
    const cipher = cipherWith([1, shared], [2, shared]);
    const stored = cipher.encrypt('Calle del Pez, 12');
    stored[0] = 2;

    expect(() => cipher.decrypt(stored)).toThrow();
  });

  it('rota la clave sin migración: descifra con la versión antigua y cifra con la nueva', () => {
    const oldKey = key();
    const old = cipherWith([1, oldKey]).encrypt('Calle del Pez, 12');
    const rotated = new AddressCipher(
      new Map([
        [1, oldKey],
        [2, key()],
      ]),
      2,
    );

    expect(rotated.decrypt(old)).toBe('Calle del Pez, 12');
    expect(rotated.encrypt('otra')[0]).toBe(2);
  });

  it('falla con una versión de clave desconocida o un valor demasiado corto', () => {
    const cipher = cipherWith([1, key()]);
    const stored = cipher.encrypt('x');
    stored[0] = 9;

    expect(() => cipher.decrypt(stored)).toThrow(/versión/);
    expect(() => cipher.decrypt(Buffer.from([1, 2, 3]))).toThrow();
  });

  it('exige claves de 32 bytes y una versión vigente entre ellas', () => {
    expect(() => new AddressCipher(new Map([[1, randomBytes(16)]]), 1)).toThrow(/32 bytes/);
    expect(() => new AddressCipher(new Map([[1, key()]]), 2)).toThrow(/versión/);
    expect(() => new AddressCipher(new Map([[256, key()]]), 256)).toThrow(/versión/);
  });

  it('fromBase64 acepta una clave base64 de 32 bytes y rechaza el resto', () => {
    const raw = key();
    const cipher = AddressCipher.fromBase64(raw.toString('base64'));

    expect(cipher.decrypt(new AddressCipher(new Map([[1, raw]]), 1).encrypt('hola'))).toBe('hola');
    expect(() => AddressCipher.fromBase64('')).toThrow(/32 bytes/);
    expect(() => AddressCipher.fromBase64(randomBytes(31).toString('base64'))).toThrow(/32 bytes/);
    expect(() => AddressCipher.fromBase64('no es base64 válido!!')).toThrow(/32 bytes/);
  });

  it('propiedad: cualquier texto vuelve intacto', () => {
    const cipher = cipherWith([1, key()]);

    fc.assert(
      fc.property(fc.string({ unit: 'binary' }), (text) => {
        expect(cipher.decrypt(cipher.encrypt(text))).toBe(text);
      }),
    );
  });
});

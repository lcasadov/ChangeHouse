import { NOTE_MAX_LENGTH, validateNote } from './resolution-note';

describe('validateNote', () => {
  it('acepta una nota y la devuelve sin espacios en los extremos', () => {
    expect(validateNote('  Sin indicios  ')).toEqual({ ok: true, note: 'Sin indicios' });
  });

  it.each(['', '   '])('rechaza una nota vacía («%s»): es obligatoria', (text) => {
    expect(validateNote(text)).toEqual({ ok: false, error: 'required' });
  });

  it('acepta exactamente 2000 caracteres y rechaza uno más', () => {
    expect(validateNote('a'.repeat(NOTE_MAX_LENGTH)).ok).toBe(true);
    expect(validateNote('a'.repeat(NOTE_MAX_LENGTH + 1))).toEqual({ ok: false, error: 'tooLong' });
  });
});
